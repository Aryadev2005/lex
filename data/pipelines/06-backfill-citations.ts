/**
 * Backfills full_citation on documents (and propagates to document_chunks).
 * Run: pnpm --filter @lex/data backfill:citations
 * Flags: --dry-run
 */

import { supabase } from './shared/db.js';
import { CheckpointManager } from './shared/checkpoint.js';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 100;

const COURT_DISPLAY: Record<string, string> = {
  'supreme-court': 'Supreme Court of India',
  'delhi-hc': 'Delhi High Court',
  'bombay-hc': 'Bombay High Court',
  'madras-hc': 'Madras High Court',
  'calcutta-hc': 'Calcutta High Court',
  'karnataka-hc': 'Karnataka High Court',
};

interface DocRow {
  id: string;
  title: string | null;
  court: string | null;
  year: number | null;
  document_type: string | null;
  metadata: Record<string, unknown> | null;
}

function buildCitation(doc: DocRow): string {
  const title = (doc.title ?? '').trim();
  const year = doc.year ? String(doc.year) : '';
  const docType = doc.document_type ?? '';

  if (docType === 'judgment') {
    const courtRaw = doc.court ?? '';
    const courtDisplay = COURT_DISPLAY[courtRaw] ?? courtRaw;
    const parts = [title, courtDisplay ? `${courtDisplay}${year ? ` (${year})` : ''}` : year ? `(${year})` : ''].filter(Boolean);
    return parts.join(', ');
  }

  if (docType === 'legislation') {
    return year ? `${title}, ${year}` : title;
  }

  return title;
}

async function fetchDocuments(): Promise<DocRow[]> {
  const all: DocRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, court_name, year, document_type, metadata')
      .or('full_citation.is.null,full_citation.eq.')
      .range(from, from + BATCH - 1);

    if (error) throw new Error(`fetchDocuments failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as Array<{
      id: string;
      title: string | null;
      court_name: string | null;
      year: number | null;
      document_type: string | null;
      metadata: Record<string, unknown> | null;
    }>) {
      all.push({
        id: row.id,
        title: row.title,
        court: row.court_name,
        year: row.year,
        document_type: row.document_type,
        metadata: row.metadata,
      });
    }

    if (data.length < BATCH) break;
    from += BATCH;
  }

  return all;
}

async function updateDocumentCitation(id: string, citation: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ full_citation: citation })
    .eq('id', id);
  if (error) throw new Error(`updateDocumentCitation(${id}) failed: ${error.message}`);
}

async function propagateToChunks(docIds: string[]): Promise<void> {
  // Fetch each document's updated citation, then bulk-update matching chunks.
  // Done in batches since PostgREST does not support cross-table UPDATE...FROM.
  const { data: docs, error: fetchErr } = await supabase
    .from('documents')
    .select('id, full_citation')
    .in('id', docIds);

  if (fetchErr) throw new Error(`propagateToChunks fetch failed: ${fetchErr.message}`);
  if (!docs || docs.length === 0) return;

  for (const doc of docs as Array<{ id: string; full_citation: string | null }>) {
    if (!doc.full_citation) continue;

    const { error } = await supabase
      .from('document_chunks')
      .update({ full_citation: doc.full_citation })
      .eq('document_id', doc.id)
      .or('full_citation.is.null,full_citation.eq.');

    if (error) {
      console.warn(`  warn: propagate chunks for doc ${doc.id} failed: ${error.message}`);
    }
  }
}

async function main() {
  console.log(`[backfill-citations] dry-run=${DRY_RUN}`);

  const checkpoint = new CheckpointManager('backfill-citations');
  const done = await checkpoint.load();
  console.log(`  checkpoint: ${done.size} already processed`);

  const docs = await fetchDocuments();
  // Re-include docs that were already in the checkpoint set by filtering them out
  const pending = docs.filter((d) => !done.has(d.id));

  console.log(`  total needing citation: ${docs.length}, pending after checkpoint: ${pending.length}`);

  if (pending.length === 0) {
    console.log('  nothing to do.');
    return;
  }

  let processed = 0;
  let errors = 0;
  const updatedIds: string[] = [];

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);

    for (const doc of batch) {
      const citation = buildCitation(doc);

      if (DRY_RUN) {
        console.log(`  [dry-run] ${doc.id} → "${citation}"`);
        processed++;
        continue;
      }

      try {
        await updateDocumentCitation(doc.id, citation);
        await checkpoint.mark(doc.id, 'success', { citation });
        updatedIds.push(doc.id);
        processed++;
      } catch (err) {
        console.error(`  error on ${doc.id}: ${(err as Error).message}`);
        await checkpoint.mark(doc.id, 'error', { error: (err as Error).message });
        errors++;
      }
    }

    console.log(`  progress: ${Math.min(i + BATCH, pending.length)} / ${pending.length}`);
  }

  if (!DRY_RUN && updatedIds.length > 0) {
    console.log(`  propagating citations to document_chunks for ${updatedIds.length} documents…`);
    try {
      await propagateToChunks(updatedIds);
      console.log('  chunks updated.');
    } catch (err) {
      console.error(`  chunk propagation error: ${(err as Error).message}`);
    }
  }

  console.log(`\n[backfill-citations] done. processed=${processed} errors=${errors}`);
}

main().catch((err) => {
  console.error('[backfill-citations] fatal:', err);
  process.exit(1);
});
