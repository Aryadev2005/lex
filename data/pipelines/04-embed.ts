import { createInterface } from 'readline';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import { supabase, updateDocumentStatus } from './shared/db.js';
import { CheckpointManager } from './shared/checkpoint.js';
import logger from './shared/logger.js';
import { prepareEmbeddingInputs } from './embedding/augmenter.js';
import { processEmbeddingBatches } from './embedding/batcher.js';
import type { DocumentChunk, EmbeddingInput } from './shared/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

// $0.13 per 1M tokens
const COST_PER_MILLION_TOKENS = 0.13;
const PAGE_SIZE = 1000; // Supabase PostgREST default max per request

interface CliArgs {
  limit: number;
  court: string | undefined;
  batchSize: number;
  yes: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined =>
    argv.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=');

  return {
    limit: get('--limit') !== undefined ? parseInt(get('--limit')!, 10) : Infinity,
    court: get('--court'),
    batchSize: get('--batch-size') !== undefined ? parseInt(get('--batch-size')!, 10) : 100,
    yes: argv.includes('--yes'),
  };
}

interface ChunkRow {
  id: string;
  content: string;
  section_hierarchy: unknown;      // jsonb string[] stored in DB
  court_name: string | null;
  year: number | null;
  document_type: string | null;
  jurisdiction: string | null;
  citation: string | null;
  legal_tags: string[] | null;
  acts_sections: unknown;          // [{act_name, sections}] or plain strings
}

async function fetchUnembeddedChunks(courtFilter?: string): Promise<ChunkRow[]> {
  const all: ChunkRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('document_chunks')
      .select('id, content, section_hierarchy, court_name, year, document_type, jurisdiction, citation, legal_tags, acts_sections')
      .is('embedding', null)
      .range(from, from + PAGE_SIZE - 1);

    if (courtFilter) {
      query = query.eq('court_name', courtFilter);
    }

    const { data, error } = await query;
    if (error) throw new Error(`fetchUnembeddedChunks failed: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...(data as ChunkRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

function castMetadata(row: ChunkRow): DocumentChunk['metadata'] {
  const rawActs = Array.isArray(row.acts_sections) ? (row.acts_sections as unknown[]) : [];
  const acts = rawActs.map(a =>
    typeof a === 'string' ? a : ((a as Record<string, unknown>)['act_name'] as string) ?? ''
  ).filter(Boolean);

  return {
    court:         row.court_name    ?? '',
    year:          row.year          ?? 0,
    document_type: row.document_type ?? '',
    jurisdiction:  row.jurisdiction  ?? '',
    concept_tags:  Array.isArray(row.legal_tags) ? row.legal_tags : [],
    acts_referenced: acts,
    full_citation: row.citation ?? '',
  };
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function estimateCost(totalTokens: number): number {
  return (totalTokens / 1_000_000) * COST_PER_MILLION_TOKENS;
}

async function askConfirmation(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function markDocumentsEmbedded(): Promise<number> {
  // Find documents where all chunks have embeddings and status != 'embedded'
  const { data, error } = await supabase.rpc('get_fully_embedded_document_ids');

  // Fallback: manual query if RPC not available
  if (error) {
    // Count total and embedded chunks per document, then update those where they match
    const { data: docs, error: docsErr } = await supabase
      .from('documents')
      .select('id')
      .neq('status', 'embedded');

    if (docsErr || !docs) return 0;

    let updated = 0;
    for (const doc of docs as Array<{ id: string }>) {
      const { count: total, error: totalErr } = await supabase
        .from('document_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', doc.id);

      const { count: embedded, error: embeddedErr } = await supabase
        .from('document_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', doc.id)
        .not('embedding', 'is', null);

      if (totalErr || embeddedErr || total === null || embedded === null) continue;
      if (total > 0 && total === embedded) {
        await updateDocumentStatus(doc.id, 'embedded');
        updated++;
      }
    }
    return updated;
  }

  if (!data || !Array.isArray(data)) return 0;
  const ids = (data as Array<{ id: string }>).map(r => r.id);
  for (const id of ids) {
    await updateDocumentStatus(id, 'embedded');
  }
  return ids.length;
}

async function main(): Promise<void> {
  const { limit, court: courtFilter, batchSize, yes } = parseArgs();

  logger.info('Starting embedding pipeline', { limit, courtFilter, batchSize });

  // Load checkpoint
  const checkpoint = new CheckpointManager('embed');
  const processedIds = await checkpoint.load();

  logger.info('Fetching un-embedded chunks from DB…');
  const allChunks = await fetchUnembeddedChunks(courtFilter);

  // Filter out already-checkpointed chunks
  const pending = allChunks.filter(c => !processedIds.has(c.id));
  const toProcess = isFinite(limit) ? pending.slice(0, limit) : pending;

  logger.info('Chunks queued for embedding', {
    totalInDB: allChunks.length,
    alreadyCheckpointed: processedIds.size,
    pending: pending.length,
    queued: toProcess.length,
  });

  if (toProcess.length === 0) {
    logger.info('Nothing to embed — all chunks already processed');
    return;
  }

  // Build EmbeddingInputs
  logger.info('Preparing embedding inputs…');
  const inputs: EmbeddingInput[] = prepareEmbeddingInputs(
    toProcess.map(c => ({
      id: c.id,
      content: c.content,
      metadata: castMetadata(c),
      section_path: toStringArray(c.section_hierarchy),
    }))
  );

  // Cost estimate
  const totalTokens = inputs.reduce((sum, i) => sum + i.token_count, 0);
  const estimatedCost = estimateCost(totalTokens);
  const totalBatches = Math.ceil(inputs.length / batchSize);

  logger.info('Cost estimate', {
    chunks: inputs.length,
    totalTokens,
    estimatedCostUSD: `$${estimatedCost.toFixed(2)}`,
    batches: totalBatches,
  });

  // Prompt for confirmation when processing large runs
  if (inputs.length > 10_000 && !yes) {
    const confirmed = await askConfirmation(
      `About to embed ${inputs.length} chunks. Estimated cost: $${estimatedCost.toFixed(2)}. Continue? (y/n) `
    );
    if (!confirmed) {
      logger.info('Aborted by user');
      process.exit(0);
    }
  }

  // Progress tracking
  let embeddedCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  await processEmbeddingBatches(
    inputs,
    async (batchIndex, total) => {
      // Derive which chunk IDs were in this batch and checkpoint them
      const start = batchIndex * batchSize;
      const batchChunkIds = inputs.slice(start, start + batchSize).map(i => i.chunk_id);

      for (const id of batchChunkIds) {
        await checkpoint.mark(id, 'success');
      }
      embeddedCount += batchChunkIds.length;

      if ((batchIndex + 1) % 10 === 0 || batchIndex === total - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const pct = (((batchIndex + 1) / total) * 100).toFixed(1);
        logger.info('Progress', {
          batch: `${batchIndex + 1}/${total}`,
          embedded: embeddedCount,
          errors: errorCount,
          pct: `${pct}%`,
          elapsedSec: elapsed,
        });
      }
    },
    batchSize
  ).catch(err => {
    errorCount++;
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Batch processing error', { error: message });
    throw err;
  });

  // Update document statuses for fully-embedded documents
  logger.info('Updating document statuses…');
  const updatedDocs = await markDocumentsEmbedded();

  // Final summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const actualTokensUsed = inputs
    .slice(0, embeddedCount)
    .reduce((sum, i) => sum + i.token_count, 0);
  const actualCost = estimateCost(actualTokensUsed);

  logger.info('Embedding pipeline complete', {
    embedded: embeddedCount,
    errors: errorCount,
    total: toProcess.length,
    batches: totalBatches,
    documentsMarkedEmbedded: updatedDocs,
    estimatedCostUSD: `$${actualCost.toFixed(2)}`,
    elapsedSec: totalElapsed,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
