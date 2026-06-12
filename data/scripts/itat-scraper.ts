import ws from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as Record<string, unknown>)['WebSocket'] = ws;
}

import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: resolve(__dirname, '../.env') });

import { CheckpointManager } from '../pipelines/shared/checkpoint.js';
import { supabase, upsertDocument } from '../pipelines/shared/db.js';
import { detectSections } from '../pipelines/chunking/detector.js';
import { buildSectionTree, flattenTree } from '../pipelines/chunking/tree.js';
import { buildDocumentChunks } from '../pipelines/chunking/splitter.js';
import type { DocumentChunk } from '../pipelines/shared/types.js';

// ── Config ────────────────────────────────────────────────────────────────────

const IK_BASE = 'https://api.indiankanoon.org';
const IK_TOKEN = process.env['INDIAN_KANOON_API_KEY'];
if (!IK_TOKEN) throw new Error('INDIAN_KANOON_API_KEY must be set in data/.env');

const ORG_ID = process.env['PIPELINE_ORG_ID'];
if (!ORG_ID) throw new Error('PIPELINE_ORG_ID must be set in data/.env');

const DELAY_MS = 700;
const PAGES_PER_QUERY = 3;
const CUTOFF_DAYS = 90;

// ── Search config ─────────────────────────────────────────────────────────────

const ITAT_SEARCHES = [
  // Mumbai bench
  { q: 'ITAT Mumbai transfer pricing income tax appeal 2025', bench: 'Mumbai' },
  { q: 'ITAT Mumbai TDS deduction section 194 income tax 2025', bench: 'Mumbai' },
  { q: 'ITAT Mumbai capital gains section 45 income tax 2025', bench: 'Mumbai' },
  { q: 'ITAT Mumbai business income section 37 deduction 2025', bench: 'Mumbai' },
  { q: 'ITAT Mumbai international taxation DTAA 2025', bench: 'Mumbai' },
  // Delhi bench
  { q: 'ITAT Delhi transfer pricing comparable ALP 2025', bench: 'Delhi' },
  { q: 'ITAT Delhi reassessment section 148 income tax 2025', bench: 'Delhi' },
  { q: 'ITAT Delhi capital gains real estate 2025', bench: 'Delhi' },
  { q: 'ITAT Delhi penalty concealment section 271 2025', bench: 'Delhi' },
  { q: 'ITAT Delhi GAAR avoidance tax 2025', bench: 'Delhi' },
  // Bengaluru bench
  { q: 'ITAT Bangalore exemption section 80IC startup 2025', bench: 'Bengaluru' },
  { q: 'ITAT Bangalore TDS software royalty section 195 2025', bench: 'Bengaluru' },
  { q: 'ITAT Bangalore income from other sources unexplained 2025', bench: 'Bengaluru' },
  { q: 'ITAT Bangalore appeal dismissal limitation 2025', bench: 'Bengaluru' },
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function ikGet(path: string): Promise<unknown> {
  const res = await fetch(`${IK_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Token ${IK_TOKEN}` },
  });
  if (!res.ok) throw new Error(`IK ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface IKSearchResult {
  docs?: Array<{
    tid: number;
    title: string;
    docsource?: string;
    publishdate?: string;
    citation?: string;
  }>;
}

interface IKDoc {
  tid: number;
  title?: string;
  doc?: string;
  docsource?: string;
  publishdate?: string;
  citation?: string;
}

// ── HTML → plain text ─────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Chunk insertion ───────────────────────────────────────────────────────────

async function insertItatChunks(
  chunks: DocumentChunk[],
  bench: string,
  courtName: string,
  citation: string,
  year: number,
): Promise<void> {
  const BATCH = 100;
  const mapChunkType = (t: string): string =>
    ({ paragraph: 'other', section_header: 'section', preamble: 'preamble', order: 'operative_clause', provision: 'section' }[t] ?? 'other');

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const { error } = await supabase.from('document_chunks').upsert(
      batch.map(c => ({
        document_id:       c.document_id,
        org_id:            ORG_ID,
        content:           c.content,
        token_count:       c.token_count,
        chunk_index:       c.chunk_index,
        chunk_type:        mapChunkType(c.chunk_type),
        section_hierarchy: c.section_path,
        court_name:        courtName,
        court_type:        'tribunal',
        jurisdiction:      'India',
        citation:          citation || null,
        year:              year || null,
        document_type:     'order',
        legal_tags:        [],
        acts_sections:     [],
        is_public:         true,
        source:            'indian_kanoon',
        tribunal:          'ITAT',
        bench_location:    bench,
        judge_name:        null,
        state:             null,
        district:          null,
      })),
    );
    if (error) throw new Error(`insertItatChunks batch ${i}: ${error.message}`);
  }
}

// ── DB dedup check ────────────────────────────────────────────────────────────

async function existsInDb(sourceUrl: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .eq('processing_metadata->>source_url', sourceUrl)
    .maybeSingle();
  if (error) return false;
  return data !== null;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

interface CliArgs {
  dryRun: boolean;
  bench:  string | null;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const benchIdx = argv.indexOf('--bench');
  const bench = benchIdx !== -1 ? (argv[benchIdx + 1] ?? null) : null;
  return { dryRun, bench };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dryRun, bench: benchFilter } = parseArgs();

  console.log(`ITAT scraper starting${dryRun ? ' [dry-run]' : ''}${benchFilter ? ` bench=${benchFilter}` : ' (all benches)'}`);

  if (!IK_TOKEN) throw new Error('INDIAN_KANOON_API_KEY not set');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CUTOFF_DAYS);

  const checkpoint = new CheckpointManager('itat-scraper');
  await checkpoint.load();

  const searches = benchFilter
    ? ITAT_SEARCHES.filter(s => s.bench.toLowerCase() === benchFilter.toLowerCase())
    : ITAT_SEARCHES;

  if (searches.length === 0) {
    console.error(`No searches configured for bench: ${benchFilter}`);
    process.exit(1);
  }

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let dryRunCount = 0;

  for (const search of searches) {
    console.log(`\n[${search.bench}] ${search.q.slice(0, 70)}…`);

    for (let pagenum = 0; pagenum < PAGES_PER_QUERY; pagenum++) {
      await sleep(DELAY_MS);

      let searchResult: IKSearchResult;
      try {
        searchResult = (await ikGet(
          `/search/?formInput=${encodeURIComponent(search.q)}&pagenum=${pagenum}`,
        )) as IKSearchResult;
      } catch (e) {
        console.warn(`  page ${pagenum} search error:`, (e as Error).message);
        break;
      }

      const hits = searchResult.docs ?? [];
      if (hits.length === 0) {
        console.log(`  page ${pagenum}: no results`);
        break;
      }

      console.log(`  page ${pagenum}: ${hits.length} hits`);

      for (const hit of hits) {
        const tid = String(hit.tid);
        const sourceUrl = `https://indiankanoon.org/doc/${hit.tid}/`;

        if (checkpoint.isProcessed(tid)) {
          totalSkipped++;
          continue;
        }

        await sleep(DELAY_MS);

        let doc: IKDoc;
        try {
          doc = (await ikGet(`/doc/${hit.tid}/`)) as IKDoc;
        } catch (e) {
          console.warn(`  tid=${tid} fetch error:`, (e as Error).message);
          totalErrors++;
          continue;
        }

        // Verify ITAT tribunal — docsource is "Income Tax Appellate Tribunal - <City>"
        // or occasionally the short form "ITAT <City>"
        const docsource = doc.docsource ?? '';
        const dsLower = docsource.toLowerCase();
        const isItat = dsLower.includes('itat') || dsLower.includes('income tax appellate tribunal');
        if (!isItat) {
          console.log(`  skip (not ITAT) tid=${tid}  docsource="${docsource}"`);
          // Checkpoint only on real runs to keep dry-run idempotent
          if (!dryRun) await checkpoint.mark(tid, 'success', { skipped: true, reason: 'not-itat', docsource });
          totalSkipped++;
          continue;
        }

        // Date filter
        if (doc.publishdate) {
          const publishDate = new Date(doc.publishdate);
          if (!isNaN(publishDate.getTime()) && publishDate < cutoffDate) {
            console.log(`  skip (old) tid=${tid}  publishdate=${doc.publishdate}`);
            if (!dryRun) await checkpoint.mark(tid, 'success', { skipped: true, reason: 'skip-old', publishdate: doc.publishdate });
            totalSkipped++;
            continue;
          }
        }

        // Extract and validate text
        const htmlText = doc.doc ?? '';
        if (!htmlText) {
          console.warn(`  tid=${tid} has no text`);
          totalErrors++;
          continue;
        }
        const plainText = stripHtml(htmlText);
        if (plainText.length < 500) {
          console.warn(`  skip (short ${plainText.length} chars) tid=${tid}`);
          if (!dryRun) await checkpoint.mark(tid, 'success', { skipped: true, reason: 'too-short', length: plainText.length });
          totalSkipped++;
          continue;
        }

        const year = parseInt(doc.publishdate?.slice(0, 4) ?? '0', 10);
        const courtName = `ITAT ${search.bench}`;
        const citation = doc.citation
          ? doc.citation
          : `${(doc.title ?? 'Unknown').replace(/<[^>]+>/g, '')}, ITAT ${search.bench} (${year || 'n.d.'})`;

        if (dryRun) {
          dryRunCount++;
          console.log(`  [dry-run] Would embed tid=${tid}  year=${year}  ${docsource.slice(0, 40)}`);
          console.log(`    ${(doc.title ?? '').replace(/<[^>]+>/g, '').slice(0, 80)}`);
          continue;
        }

        // DB dedup — catches cases where checkpoint was lost or re-seeded
        if (await existsInDb(sourceUrl)) {
          console.log(`  skip (already in DB) tid=${tid}`);
          await checkpoint.mark(tid, 'success', { skipped: true, reason: 'already-in-db' });
          totalSkipped++;
          continue;
        }

        try {
          const documentId = await upsertDocument({
            file_path:     `itat/${search.bench.toLowerCase()}/${tid}`,
            source_url:    sourceUrl,
            document_type: 'tribunal_order',
            court:         courtName,
            year,
            jurisdiction:  'India',
            language:      'en',
            status:        'chunked',
            metadata: {
              raw_text:       plainText,
              full_citation:  citation,
              judges:         [],
              tribunal:       'ITAT',
              bench_location: search.bench,
              source:         'indian_kanoon',
            },
          });

          const docMeta = {
            court:           courtName,
            year,
            document_type:   'tribunal_order',
            jurisdiction:    'India',
            concept_tags:    [] as string[],
            acts_referenced: [] as string[],
            full_citation:   citation,
          };

          const boundaries = detectSections(plainText, 'judgment');
          const tree       = buildSectionTree(boundaries);
          const flat       = flattenTree(tree);
          const chunks     = buildDocumentChunks(flat, docMeta);

          for (const c of chunks) c.document_id = documentId;

          await insertItatChunks(chunks, search.bench, courtName, citation, year);

          await checkpoint.mark(tid, 'success', {
            bench:  search.bench,
            year,
            chunks: chunks.length,
          });

          totalProcessed++;
          console.log(`  ✓ tid=${tid}  year=${year}  chunks=${chunks.length}  ${courtName}`);
          console.log(`    ${(doc.title ?? '').replace(/<[^>]+>/g, '').slice(0, 80)}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`  error tid=${tid}: ${message}`);
          totalErrors++;
        }
      }
    }
  }

  if (dryRun) {
    console.log(`\n[dry-run] Would embed ${dryRunCount} ITAT orders`);
    console.log('[dry-run] No DB writes performed');
  } else {
    console.log(`\nDone — processed=${totalProcessed}  skipped=${totalSkipped}  errors=${totalErrors}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
