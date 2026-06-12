import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import pLimit from 'p-limit';
import { supabase } from './shared/db.js';
import { CheckpointManager } from './shared/checkpoint.js';
import logger from './shared/logger.js';
import { detectSections } from './chunking/detector.js';
import { buildSectionTree, flattenTree } from './chunking/tree.js';
import { buildDocumentChunks } from './chunking/splitter.js';
import type { DocumentChunk } from './shared/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

// ── Configuration ─────────────────────────────────────────────────────────────

const DELAY_MS = parseInt(process.env['ECOURTS_DELAY_MS'] ?? '1200', 10);
const API_BASE = 'https://webapi.ecourtsindia.com';
const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

const _rawApiKey = process.env['ECOURTS_API_KEY'];
if (!_rawApiKey) throw new Error('ECOURTS_API_KEY must be set in data/.env');
const apiKey: string = _rawApiKey;

const _rawOrgId = process.env['PIPELINE_ORG_ID'];
if (!_rawOrgId) throw new Error('PIPELINE_ORG_ID must be set in data/.env');
const orgId: string = _rawOrgId;

// ── Target courts ─────────────────────────────────────────────────────────────

interface TargetCourt {
  name: string;
  state: string;
  stateCode: string;
  districtHint: string;
  complexHint: string;
}

const TARGET_COURTS: TargetCourt[] = [
  { name: 'City Civil Court, Bengaluru',        state: 'Karnataka',   stateCode: 'KA', districtHint: 'bengaluru',  complexHint: 'city civil' },
  { name: 'City Civil Court, Mumbai',           state: 'Maharashtra', stateCode: 'MH', districtHint: 'mumbai',     complexHint: 'city civil' },
  { name: 'Saket District Court, Delhi',        state: 'Delhi',       stateCode: 'DL', districtHint: 'south',      complexHint: 'saket' },
  { name: 'Egmore Civil Court, Chennai',        state: 'Tamil Nadu',  stateCode: 'TN', districtHint: 'chennai',    complexHint: 'egmore' },
  { name: 'City Civil Court, Hyderabad',        state: 'Telangana',   stateCode: 'TS', districtHint: 'hyderabad',  complexHint: 'city civil' },
  { name: 'City Civil Court, Kolkata',          state: 'West Bengal', stateCode: 'WB', districtHint: 'calcutta',   complexHint: 'city civil' },
  { name: 'Esplanade Court, Mumbai',            state: 'Maharashtra', stateCode: 'MH', districtHint: 'mumbai',     complexHint: 'esplanade' },
  { name: 'Tis Hazari District Court, Delhi',   state: 'Delhi',       stateCode: 'DL', districtHint: 'north',      complexHint: 'tis hazari' },
  { name: 'City Civil Court, Ahmedabad',        state: 'Gujarat',     stateCode: 'GJ', districtHint: 'ahmedabad',  complexHint: 'city civil' },
  { name: 'City Civil Court, Pune',             state: 'Maharashtra', stateCode: 'MH', districtHint: 'pune',       complexHint: 'city civil' },
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  label: string,
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
        logger.warn(`HTTP ${res.status} — retry ${attempt}/${MAX_RETRIES} in ${delay}ms`, { url: label });
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === MAX_RETRIES) throw err;
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
      logger.warn(`Fetch error — retry ${attempt}/${MAX_RETRIES} in ${delay}ms`, { url: label, error: String(err) });
      await sleep(delay);
    }
  }
  throw new Error(`fetchWithRetry exhausted after ${MAX_RETRIES} attempts: ${label}`);
}

async function eciGet<T>(path: string, auth: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${auth}` } }, path);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${path}`);
  return unwrap<T>(await res.json());
}

// Court-structure endpoints are free (no credit charge) but still need auth
async function eciGetFree<T>(path: string): Promise<T> {
  return eciGet<T>(path, apiKey);
}

// ── Court structure types ─────────────────────────────────────────────────────

interface StateEntry    { state: string; stateName: string; }
interface DistrictEntry { districtCode: string; districtName: string; }
interface ComplexEntry  { courtComplexCode: string; courtComplexName: string; }

// ── Resolved court ────────────────────────────────────────────────────────────

interface ResolvedCourt {
  targetCourt: TargetCourt;
  districtCode: string;
  districtName: string;
  complexCode: string;
  complexName: string;
}

// ── Court structure resolution ────────────────────────────────────────────────

function fuzzyMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function resolveCourtCodes(): Promise<ResolvedCourt[]> {
  const states = await eciGetFree<StateEntry[]>('/api/partner/causelist/court-structure/states');
  logger.info(`✓ Court structure fetched: ${states.length} states available`);

  const resolved: ResolvedCourt[] = [];

  // Group target courts by state code to minimise API calls
  const byState = new Map<string, TargetCourt[]>();
  for (const tc of TARGET_COURTS) {
    (byState.get(tc.stateCode) ?? byState.set(tc.stateCode, []).get(tc.stateCode)!).push(tc);
  }

  for (const [stateCode, courts] of byState) {
    const stateEntry = states.find(s => s.state === stateCode);
    if (!stateEntry) {
      logger.warn(`State code ${stateCode} not found in API response`);
      continue;
    }

    await sleep(DELAY_MS);
    let districts: DistrictEntry[];
    try {
      districts = await eciGetFree<DistrictEntry[]>(
        `/api/partner/causelist/court-structure/states/${stateCode}/districts`,
      );
    } catch (err) {
      logger.warn(`Failed to fetch districts for ${stateCode}`, { error: String(err) });
      continue;
    }

    for (const tc of courts) {
      const district = districts.find(d =>
        fuzzyMatch(d.districtName, tc.districtHint) ||
        fuzzyMatch(tc.districtHint, d.districtName),
      );

      if (!district) {
        logger.warn(`District not found for ${tc.name}`, { hint: tc.districtHint, available: districts.map(d => d.districtName) });
        continue;
      }

      await sleep(DELAY_MS);
      let complexes: ComplexEntry[];
      try {
        complexes = await eciGetFree<ComplexEntry[]>(
          `/api/partner/causelist/court-structure/states/${stateCode}/districts/${district.districtCode}/complexes`,
        );
      } catch (err) {
        logger.warn(`Failed to fetch complexes for ${district.districtName}`, { error: String(err) });
        continue;
      }

      // Match complex by hint; fall back to first in district
      const complex =
        complexes.find(c => fuzzyMatch(c.courtComplexName, tc.complexHint)) ??
        complexes.find(c => fuzzyMatch(c.courtComplexName, tc.districtHint)) ??
        complexes[0];

      if (!complex) {
        logger.warn(`No court complex found for ${tc.name}`);
        continue;
      }

      resolved.push({
        targetCourt: tc,
        districtCode: district.districtCode,
        districtName: district.districtName,
        complexCode: complex.courtComplexCode,
        complexName: complex.courtComplexName,
      });

      logger.info(`  ✓ Resolved ${tc.name}`, { district: district.districtName, complex: complex.courtComplexName });
      await sleep(DELAY_MS);
    }
  }

  logger.info(`✓ Court structure fetched for ${resolved.length} target courts`);
  return resolved;
}

// ── Cause list ────────────────────────────────────────────────────────────────

interface CauseListEntry {
  cnr:        string | null;
  caseNumber: string[];
  party:      string;
  judge:      string[];
  advocate:   string[];
  date:       string;
  status:     string;
}

interface CauseListResponse {
  results:    CauseListEntry[];
  totalHits?: number;
}

async function fetchCauseList(rc: ResolvedCourt, date: string): Promise<CauseListEntry[]> {
  const all: CauseListEntry[] = [];
  let offset = 0;
  const PAGE = 100;

  while (true) {
    const params = new URLSearchParams({
      date,
      state:            rc.targetCourt.stateCode,
      districtCode:     rc.districtCode,
      courtComplexCode: rc.complexCode,
      limit:            String(PAGE),
      offset:           String(offset),
    });

    const result = await eciGet<CauseListResponse>(
      `/api/partner/causelist/search?${params}`,
      apiKey,
    );

    const page = result.results ?? [];
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
    await sleep(DELAY_MS);
  }

  return all;
}

// ── Case detail ───────────────────────────────────────────────────────────────

interface OrderRef {
  orderDate: string;
  orderUrl:  string;
}

interface CaseDetailData {
  courtCaseData: {
    judges:     string[];
    caseNumber: string;
    caseType:   string;
    caseStatus: string;
  };
  judgmentOrders: OrderRef[];
  interimOrders:  OrderRef[];
}

async function fetchCaseDetail(cnr: string): Promise<CaseDetailData> {
  return eciGet<CaseDetailData>(`/api/partner/case/${cnr}`, apiKey);
}

// ── Order markdown ────────────────────────────────────────────────────────────

interface OrderMarkdownData {
  pdfBase64:       string;
  markdownContent: string;
}

async function fetchOrderMarkdown(cnr: string, filename: string): Promise<string> {
  const data = await eciGet<OrderMarkdownData>(
    `/api/partner/case/${cnr}/order-md/${encodeURIComponent(filename)}`,
    apiKey,
  );
  return data.markdownContent ?? '';
}

// ── Database helpers ──────────────────────────────────────────────────────────

async function upsertECourtsDocument(opts: {
  cnr:          string;
  filename:     string;
  court:        TargetCourt;
  districtName: string;
  judgeName:    string;
  markdownText: string;
  year:         number;
}): Promise<string> {
  const filePath = `ecourts/${opts.cnr}/${opts.filename}`;

  // Check for existing row first to avoid duplicates on re-runs
  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('file_path', filePath)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const row = {
    org_id:         orgId,
    file_name:      opts.filename,
    file_path:      filePath,
    storage_bucket: 'documents',
    source:         'ecourts_api',
    document_type:  'order',
    court_name:     opts.court.name,
    court_type:     'district_court',
    jurisdiction:   opts.court.state,
    year:           opts.year,
    judge_names:    opts.judgeName ? [opts.judgeName] : [],
    party_names:    {},
    legal_tags:     [],
    legal_principles: [],
    acts_sections:  [],
    status:         'chunked',
    is_public:      true,
    state_name:     opts.court.state,
    district_name:  opts.districtName,
    processing_metadata: {
      source:    'ecourts_api',
      cnr:       opts.cnr,
      filename:  opts.filename,
      tribunal:  null,
    },
    content_text: opts.markdownText,
  };

  const { data, error } = await supabase
    .from('documents')
    .insert(row)
    .select('id')
    .single();

  if (error) throw new Error(`upsertECourtsDocument failed: ${error.message}`);
  return (data as { id: string }).id;
}

interface ChunkMeta {
  courtName:    string;
  state:        string;
  districtName: string;
  judgeName:    string;
}

async function insertECourtsChunks(
  chunks: DocumentChunk[],
  meta: ChunkMeta,
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
        court_name:        meta.courtName,
        court_type:        'district_court',
        jurisdiction:      c.metadata.jurisdiction ?? null,
        citation:          c.metadata.full_citation ?? null,
        year:              c.metadata.year ?? null,
        document_type:     'order',
        legal_tags:        [],
        acts_sections:     [],
        is_public:         true,
        judge_name:        meta.judgeName || null,
        state:             meta.state || null,
        district:          meta.districtName || null,
        source:            'ecourts_api',
        tribunal:          null,
      })),
    );
    if (error) throw new Error(`insertECourtsChunks batch ${i} failed: ${error.message}`);
  }
}

// ── CLI args ──────────────────────────────────────────────────────────────────

interface CliArgs { dryRun: boolean; date: string; days: number; }

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const getNext = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const today = new Date().toISOString().slice(0, 10);
  return {
    dryRun: argv.includes('--dry-run'),
    date:   getNext('--date') ?? today,
    days:   parseInt(getNext('--days') ?? '1', 10),
  };
}

function buildDateRange(endDate: string, days: number): string[] {
  const dates: string[] = [];
  const end = new Date(endDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dryRun, date, days } = parseArgs();
  const dates = buildDateRange(date, days);

  logger.info('Starting eCourts sync', {
    dryRun,
    endDate: date,
    days,
    from: dates[dates.length - 1],
    to:   dates[0],
  });
  logger.info('✓ API key loaded');

  const checkpoint = new CheckpointManager('ecourts-sync');
  await checkpoint.load();

  const resolvedCourts = await resolveCourtCodes();
  if (resolvedCourts.length === 0) {
    logger.error('No courts resolved — aborting');
    process.exit(1);
  }

  const limiter = pLimit(CONCURRENCY);
  let totalOrders = 0;
  let totalChunks = 0;
  let skipped = 0;
  let errors = 0;

  const courtTasks = resolvedCourts.map(rc =>
    limiter(async () => {
      for (const syncDate of dates) {
        let entries: CauseListEntry[];
        try {
          await sleep(DELAY_MS);
          entries = await fetchCauseList(rc, syncDate);
        } catch (err) {
          logger.error(`Cause list fetch failed — skipping court for ${syncDate}`, {
            court: rc.targetCourt.name,
            error: String(err),
          });
          continue;
        }

        if (entries.length === 0) {
          logger.info(`No orders on ${syncDate}`, { court: rc.targetCourt.name });
          continue;
        }

        logger.info(`Cause list entries found`, {
          court: rc.targetCourt.name,
          date:  syncDate,
          count: entries.length,
        });

        const withCnr = entries.filter(e => e.cnr);

        for (const entry of withCnr) {
          const cnr = entry.cnr!;

          let caseDetail: CaseDetailData;
          try {
            await sleep(DELAY_MS);
            caseDetail = await fetchCaseDetail(cnr);
          } catch (err) {
            logger.warn(`Case detail fetch failed`, { cnr, error: String(err) });
            continue;
          }

          const allOrders: OrderRef[] = [
            ...(caseDetail.judgmentOrders ?? []),
            ...(caseDetail.interimOrders  ?? []),
          ];

          // Only process orders issued on the sync date
          const dateOrders = allOrders.filter(o => o.orderDate?.startsWith(syncDate));
          if (dateOrders.length === 0) continue;

          for (const order of dateOrders) {
            const filename = order.orderUrl.split('/').pop() ?? order.orderUrl;
            const orderId  = `${cnr}/${filename}`;

            if (checkpoint.isProcessed(orderId)) {
              skipped++;
              continue;
            }

            if (dryRun) {
              logger.info(`[dry-run] Would process order`, {
                orderId,
                court: rc.targetCourt.name,
                date:  syncDate,
              });
              totalOrders++;
              continue;
            }

            try {
              await sleep(DELAY_MS);
              const markdown = await fetchOrderMarkdown(cnr, filename);

              if (!markdown?.trim()) {
                logger.warn(`Empty markdown for ${orderId}`);
                await checkpoint.mark(orderId, 'skip', { reason: 'empty markdown' });
                continue;
              }

              const year      = parseInt(syncDate.slice(0, 4), 10);
              const judgeName =
                entry.judge?.[0] ??
                caseDetail.courtCaseData?.judges?.[0] ??
                '';

              const documentId = await upsertECourtsDocument({
                cnr,
                filename,
                court:        rc.targetCourt,
                districtName: rc.districtName,
                judgeName,
                markdownText: markdown,
                year,
              });

              const docMeta = {
                court:           rc.targetCourt.name,
                year,
                document_type:   'tribunal_order',
                jurisdiction:    rc.targetCourt.state,
                concept_tags:    [] as string[],
                acts_referenced: [] as string[],
                full_citation:   cnr,
                detectionType:   'judgment' as const,
              };

              const boundaries = detectSections(markdown, 'judgment');
              const tree       = buildSectionTree(boundaries);
              const flat       = flattenTree(tree);
              const chunks     = buildDocumentChunks(flat, docMeta);

              for (const c of chunks) c.document_id = documentId;

              await insertECourtsChunks(chunks, {
                courtName:    rc.targetCourt.name,
                state:        rc.targetCourt.state,
                districtName: rc.districtName,
                judgeName,
              });

              await checkpoint.mark(orderId, 'success', {
                chunks: chunks.length,
                court:  rc.targetCourt.name,
              });

              totalOrders++;
              totalChunks += chunks.length;
              logger.info(`Processed order`, { orderId, chunks: chunks.length });

            } catch (orderErr) {
              errors++;
              const message = orderErr instanceof Error ? orderErr.message : String(orderErr);
              logger.error(`Failed to process order ${orderId}`, { error: message });
              await checkpoint.mark(orderId, 'error', { error: message });
            }
          }
        }
      }
    }),
  );

  await Promise.all(courtTasks);

  if (dryRun) {
    logger.info(`[dry-run] Would embed X chunks from ${totalOrders} orders`);
    logger.info('[dry-run] No DB writes in dry-run mode');
  } else {
    logger.info('eCourts sync complete', { totalOrders, totalChunks, skipped, errors });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
