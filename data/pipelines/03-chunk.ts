import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import pLimit from 'p-limit';
import { supabase, insertChunks, updateDocumentStatus } from './shared/db.js';
import { CheckpointManager } from './shared/checkpoint.js';
import logger from './shared/logger.js';
import { detectSections } from './chunking/detector.js';
import { buildSectionTree, flattenTree } from './chunking/tree.js';
import { buildDocumentChunks } from './chunking/splitter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

interface CliArgs {
  dryRun: boolean;
  limit: number;
  court: string | undefined;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined =>
    argv.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=');
  return {
    dryRun: argv.includes('--dry-run'),
    limit: get('--limit') !== undefined ? parseInt(get('--limit')!, 10) : Infinity,
    court: get('--court'),
  };
}

interface DocRow {
  id: string;
  content_text: string | null;
  citation: string | null;
  acts_sections: unknown;
  legal_tags: string[] | null;
  legal_principles: string[] | null;
  court_name: string | null;
  court_type: string | null;
  year: number | null;
  document_type: string;
  jurisdiction: string | null;
}

// Fetch all enriched documents using range-based pagination (content_text is large)
async function fetchEnrichedDocs(courtFilter?: string): Promise<DocRow[]> {
  const all: DocRow[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    let query = supabase
      .from('documents')
      .select('id, content_text, citation, acts_sections, legal_tags, legal_principles, court_name, court_type, year, document_type, jurisdiction')
      .eq('status', 'enriched')
      .range(from, from + pageSize - 1);

    if (courtFilter) {
      query = query.eq('court_name', courtFilter);
    }

    const { data, error } = await query;
    if (error) throw new Error(`fetchEnrichedDocs failed: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...(data as DocRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function resolveDocType(
  raw: string,
): 'judgment' | 'legislation' | 'tribunal_order' {
  const lower = raw.toLowerCase();
  if (lower === 'legislation') return 'legislation';
  if (lower === 'tribunal_order') return 'tribunal_order';
  return 'judgment';
}

function extractMeta(row: DocRow): {
  court: string;
  year: number;
  document_type: string;
  jurisdiction: string;
  concept_tags: string[];
  acts_referenced: string[];
  full_citation: string;
  detectionType: 'judgment' | 'legislation';
} {
  // acts_sections is stored as [{act_name, sections}] or plain strings
  const rawActs = Array.isArray(row.acts_sections) ? (row.acts_sections as unknown[]) : [];
  const actsList: string[] = rawActs.map(a =>
    typeof a === 'string' ? a : ((a as Record<string, unknown>)['act_name'] as string) ?? '',
  ).filter(Boolean);

  const docType = resolveDocType(row.document_type);

  return {
    court:           row.court_name ?? 'Unknown',
    year:            row.year ?? 0,
    document_type:   row.document_type,
    jurisdiction:    row.jurisdiction ?? 'India',
    concept_tags:    row.legal_tags ?? [],
    acts_referenced: actsList,
    full_citation:   row.citation ?? '',
    detectionType:   docType === 'legislation' ? 'legislation' : 'judgment',
  };
}

async function main(): Promise<void> {
  const { dryRun, limit, court: courtFilter } = parseArgs();

  logger.info('Starting chunking pipeline', { dryRun, limit, courtFilter });

  const checkpoint = new CheckpointManager('chunk');
  const processed = await checkpoint.load();

  const docs = await fetchEnrichedDocs(courtFilter);
  const pending = docs.filter(d => !checkpoint.isProcessed(d.id));
  const toProcess = isFinite(limit) ? pending.slice(0, limit) : pending;

  logger.info('Documents queued', {
    total: docs.length,
    alreadyDone: processed.size,
    pending: pending.length,
    queued: toProcess.length,
  });

  if (toProcess.length === 0) {
    logger.info('Nothing to chunk — all documents already checkpointed');
    return;
  }

  const limiter = pLimit(8);
  let succeeded = 0;
  let failed = 0;
  let done = 0;
  let totalChunks = 0;
  let totalTokens = 0;

  const tasks = toProcess.map(row =>
    limiter(async () => {
      if (!row.content_text || row.content_text.trim().length === 0) {
        logger.warn(`Skipping document with no text: ${row.id}`);
        await checkpoint.mark(row.id, 'skip', { reason: 'no content_text' });
        done++;
        return;
      }

      try {
        const meta = extractMeta(row);

        // Detect → tree → flatten → chunk
        const boundaries = detectSections(row.content_text!, meta.detectionType);
        const tree = buildSectionTree(boundaries);
        const flat = flattenTree(tree);
        const chunks = buildDocumentChunks(flat, meta);

        // Wire in the document_id
        for (const c of chunks) c.document_id = row.id;

        const chunkCount = chunks.length;
        const avgTokens =
          chunkCount > 0
            ? Math.round(chunks.reduce((s, c) => s + c.token_count, 0) / chunkCount)
            : 0;

        if (!dryRun) {
          await insertChunks(chunks);
          await updateDocumentStatus(row.id, 'chunked');
        } else {
          logger.info(`[DRY RUN] ${row.id}`, {
            chunks: chunkCount,
            avgTokens,
            sections: flat.length,
          });
        }

        await checkpoint.mark(row.id, 'success', { chunks: chunkCount, avgTokens });

        totalChunks += chunkCount;
        totalTokens += chunks.reduce((s, c) => s + c.token_count, 0);
        succeeded++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Chunking failed: ${row.id}`, { error: message });
        await checkpoint.mark(row.id, 'error', { error: message });
      }

      done++;
      if (done % 50 === 0) {
        logger.info('Progress', { done, succeeded, failed, total: toProcess.length });
      }
    }),
  );

  await Promise.all(tasks);

  const avgChunksPerDoc = succeeded > 0 ? (totalChunks / succeeded).toFixed(1) : '0';
  const avgTokensPerChunk =
    totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0;

  logger.info('Chunking complete', {
    succeeded,
    failed,
    skipped: docs.length - pending.length,
    totalChunks,
    avgChunksPerDoc,
    avgTokensPerChunk,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
