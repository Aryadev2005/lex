import { chromium, type Browser, type Page } from 'playwright';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import pLimit from 'p-limit';
import logger from '../pipelines/shared/logger.js';
import { CheckpointManager } from '../pipelines/shared/checkpoint.js';
import { supabase, upsertDocument } from '../pipelines/shared/db.js';
import { extractNativePdf } from '../pipelines/extractors/native-pdf.js';
import { detectSections } from '../pipelines/chunking/detector.js';
import { buildSectionTree, flattenTree } from '../pipelines/chunking/tree.js';
import { buildDocumentChunks } from '../pipelines/chunking/splitter.js';
import type { PipelineDocument, DocumentChunk } from '../pipelines/shared/types.js';

const __dirname = pathDirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://ibbi.gov.in';
const DELAY_MS = parseInt(process.env['NCLT_DELAY_MS'] ?? '1500', 10);
const CACHE_DIR = resolve(__dirname, '../.cache/nclt-pdfs');

const _rawOrgId = process.env['PIPELINE_ORG_ID'];
if (!_rawOrgId) throw new Error('PIPELINE_ORG_ID must be set in data/.env');
const orgId: string = _rawOrgId;

// ── Bench mapping ─────────────────────────────────────────────────────────────

const BENCH_MAP = {
  MB:  { name: 'NCLT Mumbai',          city: 'Mumbai' },
  ND:  { name: 'NCLT New Delhi',       city: 'New Delhi' },
  PB:  { name: 'NCLT Principal Bench', city: 'New Delhi' },
  KB:  { name: 'NCLT Kolkata',         city: 'Kolkata' },
  CHE: { name: 'NCLT Chennai',         city: 'Chennai' },
} as const;

type BenchCode = keyof typeof BENCH_MAP;
const ALL_BENCHES: BenchCode[] = ['MB', 'ND', 'PB', 'KB', 'CHE'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawRow {
  date:    string;
  subject: string;
  onclick: string;
  remark:  string;
  pageUrl: string;
}

interface ParsedOrder {
  partyName:  string;
  caseNumber: string;
  benchCode:  BenchCode;
  benchName:  string;
  benchCity:  string;
  orderDate:  Date;
  year:       number;
  remark:     string;
  pdfUrl:     string;
  sourceUrl:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9.\-]/g, '_').replace(/_+/g, '_').slice(0, 120);
}

// Extract relative PDF path from onclick="javascript:newwindow1('/uploads/order/HASH.pdf');"
function extractPdfPath(onclick: string): string | null {
  const m = onclick.match(/newwindow1\(['"]([^'"]+)['"]\)/);
  return m?.[1] ?? null;
}

// Parse "11 Jun, 2026" → Date
function parseDate(s: string): Date {
  return new Date(s.replace(',', ''));
}

// Detect bench code in case number string.
// Handles: /KB/, (MB), (MB-IV), (ND), /CHE/, (PB), etc.
function detectBenchCode(caseNumber: string): BenchCode | null {
  const m = caseNumber.match(/[\/\(](MB|ND|PB|KB|CHE)[-\/\)\s\d]/i);
  if (!m) return null;
  const code = m[1]!.toUpperCase() as BenchCode;
  return code in BENCH_MAP ? code : null;
}

// Parse subject text: "In the matter of PARTY NAME [CASE NO] (SIZE KB)"
function parseSubject(raw: string): { partyName: string; caseNumber: string } {
  const cleaned = raw.replace(/\s*\(\d[\d.,]* KB\)\s*$/, '').trim();
  const caseMatch = cleaned.match(/\[([^\]]+)\]/);
  const caseNumber = caseMatch?.[1]?.trim() ?? '';
  const partyName = (cleaned.split('[')[0] ?? '')
    .replace(/^In the matter of\s*/i, '')
    .trim();
  return { partyName, caseNumber };
}

function rowToOrder(row: RawRow, targetBenches: BenchCode[]): ParsedOrder | null {
  const pdfPath = extractPdfPath(row.onclick);
  if (!pdfPath) return null;

  const { partyName, caseNumber } = parseSubject(row.subject);
  if (!caseNumber) return null;

  const benchCode = detectBenchCode(caseNumber);
  if (!benchCode || !targetBenches.includes(benchCode)) return null;

  const orderDate = parseDate(row.date);
  if (isNaN(orderDate.getTime())) return null;

  const bench = BENCH_MAP[benchCode];
  return {
    partyName,
    caseNumber,
    benchCode,
    benchName: bench.name,
    benchCity: bench.city,
    orderDate,
    year:      orderDate.getFullYear(),
    remark:    row.remark.replace(/\s+/g, ' ').trim(),
    pdfUrl:    `${BASE_URL}${pdfPath}`,
    sourceUrl: row.pageUrl,
  };
}

// ── PDF download ──────────────────────────────────────────────────────────────

async function downloadPdf(url: string, destPath: string): Promise<boolean> {
  if (existsSync(destPath)) return true; // already cached

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer':    BASE_URL,
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1_000) throw new Error('file too small');
    await writeFile(destPath, Buffer.from(buf));
    return true;
  } catch (err) {
    logger.warn(`PDF download failed: ${url}`, { error: String(err) });
    return false;
  }
}

// ── Text extraction ───────────────────────────────────────────────────────────

async function extractText(pdfPath: string): Promise<string> {
  const { text } = await extractNativePdf(pdfPath);
  if (text.trim().length >= 200) return text;

  logger.warn(`pdfjs yielded < 200 chars, trying OCR`, { file: pdfPath });
  try {
    // Dynamic import so a missing Ghostscript doesn't crash the process at startup
    const { extractOcrPdf } = await import('../pipelines/extractors/ocr-pdf.js');
    const result = await extractOcrPdf(pdfPath);
    if (result.text.trim().length > text.trim().length) return result.text;
  } catch (err) {
    logger.warn('OCR fallback failed', { error: String(err) });
  }
  return text;
}

// ── NCLT-specific chunk insert ────────────────────────────────────────────────

async function insertNcltChunks(
  chunks: DocumentChunk[],
  order: ParsedOrder,
): Promise<void> {
  const BATCH = 100;
  const mapChunkType = (t: string): string => ({
    paragraph:      'other',
    section_header: 'section',
    preamble:       'preamble',
    order:          'operative_clause',
    provision:      'section',
  }[t] ?? 'other');

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const { error } = await supabase.from('document_chunks').upsert(
      batch.map(c => ({
        document_id:       c.document_id,
        org_id:            orgId,
        content:           c.content,
        token_count:       c.token_count,
        chunk_index:       c.chunk_index,
        chunk_type:        mapChunkType(c.chunk_type),
        section_hierarchy: c.section_path,
        court_name:        order.benchName,
        court_type:        'nclt',
        jurisdiction:      'India',
        citation:          c.metadata.full_citation ?? null,
        year:              order.year,
        document_type:     'order',
        legal_tags:        [],
        acts_sections:     [],
        is_public:         true,
        source:            'ibbi_scrape',
        tribunal:          'NCLT',
        bench_location:    order.benchCity,
        judge_name:        null,
        state:             null,
        district:          null,
      })),
    );
    if (error) throw new Error(`insertNcltChunks batch ${i}: ${error.message}`);
  }
}

// ── Process a single order ────────────────────────────────────────────────────

async function processOrder(
  order: ParsedOrder,
  checkpoint: CheckpointManager,
  dryRun: boolean,
): Promise<'success' | 'skip' | 'error'> {
  if (checkpoint.isProcessed(order.pdfUrl)) return 'skip';

  if (dryRun) {
    logger.info('[dry-run] Would download and embed order', {
      case:  order.caseNumber,
      bench: order.benchCode,
      date:  order.orderDate.toISOString().slice(0, 10),
    });
    return 'skip';
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const pdfFilename = sanitizeFilename(order.caseNumber) + '.pdf';
  const pdfPath = join(CACHE_DIR, pdfFilename);

  const downloaded = await downloadPdf(order.pdfUrl, pdfPath);
  if (!downloaded) {
    await checkpoint.mark(order.pdfUrl, 'error', { error: 'download failed' });
    return 'error';
  }

  try {
    const text = await extractText(pdfPath);
    if (!text.trim()) {
      logger.warn('No text extracted', { case: order.caseNumber });
      await checkpoint.mark(order.pdfUrl, 'error', { error: 'no text extracted' });
      return 'error';
    }

    const fullCitation = `${order.partyName}, [${order.caseNumber}] (${order.benchName}, ${order.year})`;

    const doc: Partial<PipelineDocument> = {
      file_path:     `nclt/${order.benchCode}/${sanitizeFilename(order.caseNumber)}`,
      source_url:    order.sourceUrl,
      document_type: 'tribunal_order',
      court:         order.benchName,
      year:          order.year,
      jurisdiction:  'India',
      language:      'en',
      status:        'chunked',
      metadata: {
        raw_text:       text,
        full_citation:  fullCitation,
        judges:         [],
        tribunal:       'NCLT',
        bench_code:     order.benchCode,
        bench_location: order.benchCity,
        remark:         order.remark,
        party_name:     order.partyName,
        case_number:    order.caseNumber,
        order_date:     order.orderDate.toISOString(),
        source:         'ibbi_scrape',
      },
    };

    const documentId = await upsertDocument(doc);

    const docMeta = {
      court:           order.benchName,
      year:            order.year,
      document_type:   'tribunal_order',
      jurisdiction:    'India',
      concept_tags:    [] as string[],
      acts_referenced: [] as string[],
      full_citation:   fullCitation,
    };

    const boundaries = detectSections(text, 'judgment');
    const tree       = buildSectionTree(boundaries);
    const flat       = flattenTree(tree);
    const chunks     = buildDocumentChunks(flat, docMeta);

    for (const c of chunks) c.document_id = documentId;

    await insertNcltChunks(chunks, order);
    await checkpoint.mark(order.pdfUrl, 'success', {
      case:   order.caseNumber,
      bench:  order.benchCode,
      chunks: chunks.length,
    });

    logger.info('✓ Order processed', {
      case:   order.caseNumber,
      bench:  order.benchCode,
      chunks: chunks.length,
    });

    return 'success';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Order processing failed: ${order.caseNumber}`, { error: message });
    await checkpoint.mark(order.pdfUrl, 'error', { error: message });
    return 'error';
  } finally {
    // Always delete the cached PDF to save disk space
    await unlink(pdfPath).catch(() => {});
  }
}

// ── Page scraper ──────────────────────────────────────────────────────────────

async function fetchRows(page: Page, pageNum: number): Promise<RawRow[]> {
  const url = `${BASE_URL}/orders/nclt?page=${pageNum}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  return page.locator('table tbody tr').evaluateAll(rows =>
    rows.map(row => {
      const cells = row.querySelectorAll('td');
      const anchor = cells[2] ? cells[2].querySelector('a') : null;
      return {
        date:    cells[1] ? cells[1].textContent!.trim() : '',
        subject: anchor   ? anchor.textContent!.trim()   : '',
        onclick: anchor   ? (anchor.getAttribute('onclick') ?? '') : '',
        remark:  cells[3] ? cells[3].textContent!.trim() : '',
        pageUrl: window.location.href,
      };
    }).filter(r => r.date.length > 0 && r.onclick.length > 0),
  );
}

// ── CLI ───────────────────────────────────────────────────────────────────────

interface CliArgs {
  dryRun:   boolean;
  daysBack: number;
  benches:  BenchCode[];
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const getNext = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };

  const benchArg = getNext('--bench');
  let benches: BenchCode[] = ALL_BENCHES;
  if (benchArg) {
    const parsed = benchArg
      .split(',')
      .map(b => b.trim().toUpperCase())
      .filter((b): b is BenchCode => b in BENCH_MAP);
    if (parsed.length > 0) benches = parsed;
  }

  return {
    dryRun:   argv.includes('--dry-run'),
    daysBack: parseInt(getNext('--days-back') ?? '180', 10),
    benches,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dryRun, daysBack, benches } = parseArgs();

  logger.info('Starting NCLT scraper', { dryRun, daysBack, benches });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  cutoff.setHours(0, 0, 0, 0);

  const checkpoint = new CheckpointManager('nclt-scraper');
  await checkpoint.load();

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page: Page = await context.newPage();

  // p-limit with concurrency 1 — PDF download + embed is inherently serial
  const limiter = pLimit(1);

  let totalOrders  = 0;
  let matchedOrders = 0;
  let succeeded    = 0;
  let errors       = 0;
  let skipped      = 0;
  let done = false;

  try {
    for (let pageNum = 1; !done; pageNum++) {
      logger.info(`Fetching page ${pageNum}…`);

      let rows: RawRow[];
      try {
        rows = await fetchRows(page, pageNum);
        await sleep(DELAY_MS);
      } catch (err) {
        logger.error(`Failed to fetch page ${pageNum}`, { error: String(err) });
        break;
      }

      if (rows.length === 0) {
        logger.info(`Page ${pageNum} returned no rows — stopping`);
        break;
      }

      totalOrders += rows.length;
      logger.info(`Page ${pageNum} fetched, ${rows.length} total orders found`);

      // Parse and filter rows
      const orders: ParsedOrder[] = [];
      for (const row of rows) {
        const order = rowToOrder(row, benches);
        if (!order) continue;

        // Stop pagination if this order is older than cutoff
        if (order.orderDate < cutoff) {
          logger.info(`Reached cutoff date (${cutoff.toISOString().slice(0, 10)}) — stopping pagination`);
          done = true;
          break;
        }
        orders.push(order);
      }

      const pageMatched = orders.length;
      matchedOrders += pageMatched;
      logger.info(`${pageMatched} orders match target benches (${benches.join('/')}) on page ${pageNum}`);

      if (dryRun) {
        // In dry-run, just count — don't call processOrder to avoid checkpoint side effects
        for (const order of orders) {
          logger.info('[dry-run] Would download and embed order', {
            case:  order.caseNumber,
            bench: order.benchCode,
            date:  order.orderDate.toISOString().slice(0, 10),
          });
        }
        continue;
      }

      // Process each matching order (serially via limiter)
      const tasks = orders.map(order =>
        limiter(async () => {
          const result = await processOrder(order, checkpoint, false);
          if (result === 'success') succeeded++;
          else if (result === 'error') errors++;
          else skipped++;
          await sleep(DELAY_MS);
        }),
      );
      await Promise.all(tasks);
    }
  } finally {
    await browser.close();
  }

  if (dryRun) {
    logger.info(`[dry-run] Would download and embed ${matchedOrders} orders`);
    logger.info('[dry-run] No DB writes in dry-run mode');
  } else {
    logger.info('NCLT scrape complete', {
      pagesScanned: totalOrders > 0 ? Math.ceil(totalOrders / 20) : 0,
      totalOrders,
      matchedOrders,
      succeeded,
      errors,
      skipped,
    });
  }
}

main().catch(err => {
  logger.error('Fatal error', { error: String(err) });
  process.exit(1);
});
