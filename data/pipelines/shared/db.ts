import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';
import type { PipelineDocument, DocumentChunk } from './types.js';

// Node.js 20 lacks native WebSocket; polyfill before createClient
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as Record<string, unknown>)['WebSocket'] = ws;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !key) {
  throw new Error(
    'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in data/.env'
  );
}

export const supabase: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false },
});

// ── Schema-to-pipeline type mappings ─────────────────────────────────────────

function pipelineOrgId(): string {
  const id = process.env['PIPELINE_ORG_ID'];
  if (!id) throw new Error('Missing PIPELINE_ORG_ID env var');
  return id;
}

function mapDocumentType(t: string): string {
  if (t === 'legislation') return 'legislation';
  if (t === 'tribunal_order') return 'order';
  if (t === 'judgment') return 'judgment';
  return 'other';
}

function mapCourtType(court: string): string {
  const lower = court.toLowerCase();
  if (lower.includes('supreme')) return 'supreme_court';
  if (lower.includes('nclt') || lower.includes('nclat')) return 'nclt';
  if (lower.includes('tribunal')) return 'tribunal';
  if (lower.includes('high')) return 'high_court';
  if (lower.includes('district')) return 'district_court';
  if (lower.includes('sessions')) return 'sessions_court';
  if (lower.includes('family')) return 'family_court';
  if (lower.includes('consumer')) return 'consumer_forum';
  if (lower.includes('labour')) return 'labour_court';
  return 'other';
}

function mapStatus(s: string): string {
  const map: Record<string, string> = {
    downloaded: 'uploaded',
    extracted: 'extracted',
    enriched:  'enriched',
    chunked:   'chunked',
    embedded:  'embedded',
    error:     'failed',
  };
  return map[s] ?? 'uploaded';
}

// Pipeline chunk_type → DB chunk_type enum
function mapChunkType(t: string): string {
  const map: Record<string, string> = {
    paragraph:      'other',
    section_header: 'section',
    preamble:       'preamble',
    order:          'operative_clause',
    provision:      'section',
  };
  return map[t] ?? 'other';
}

// ── Document operations ───────────────────────────────────────────────────────

export async function upsertDocument(doc: Partial<PipelineDocument>): Promise<string> {
  const orgId = pipelineOrgId();
  const m = doc.metadata ?? {};

  const row: Record<string, unknown> = {
    org_id:           orgId,
    file_name:        doc.file_path?.split('/').pop() ?? 'unknown',
    file_path:        doc.file_path ?? '',
    storage_bucket:   'documents',
    source:           'public_corpus',
    document_type:    mapDocumentType(doc.document_type ?? ''),
    court_name:       doc.court ?? null,
    court_type:       doc.court ? mapCourtType(doc.court) : null,
    jurisdiction:     doc.jurisdiction ?? null,
    year:             doc.year ?? null,
    citation:         (m['full_citation'] as string | undefined) ?? null,
    judge_names:      Array.isArray(m['judges']) ? m['judges'] : [],
    party_names:      m['parties'] ?? {},
    outcome:          (m['outcome'] as string | undefined) ?? null,
    legal_tags:       Array.isArray(m['concept_tags']) ? m['concept_tags'] : [],
    legal_principles: Array.isArray(m['legal_principles']) ? m['legal_principles'] : [],
    acts_sections:    Array.isArray(m['acts_referenced']) ? m['acts_referenced'] : [],
    status:           mapStatus(doc.status ?? ''),
    is_public:        true,
    processing_metadata: {
      source_url:        doc.source_url,
      language:          doc.language,
      pipeline_metadata: m,
    },
  };

  // Include raw text if available
  if (typeof m['raw_text'] === 'string') {
    row['content_text'] = m['raw_text'];
  }

  if (doc.supabase_id) {
    const { data, error } = await supabase
      .from('documents')
      .update(row)
      .eq('id', doc.supabase_id)
      .select('id')
      .single();
    if (error) throw new Error(`upsertDocument update failed: ${error.message}`);
    return (data as { id: string }).id;
  }

  const { data, error } = await supabase
    .from('documents')
    .insert(row)
    .select('id')
    .single();

  if (error) throw new Error(`upsertDocument insert failed: ${error.message}`);
  return (data as { id: string }).id;
}

export async function updateDocumentStatus(
  id: string,
  status: string,
  errorMsg?: string
): Promise<void> {
  const update: Record<string, unknown> = { status: mapStatus(status) };
  if (errorMsg !== undefined) {
    update['processing_error'] = errorMsg;
  }

  const { error } = await supabase.from('documents').update(update).eq('id', id);
  if (error) throw new Error(`updateDocumentStatus failed: ${error.message}`);
}

export async function setDocumentText(id: string, text: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ content_text: text })
    .eq('id', id);
  if (error) throw new Error(`setDocumentText failed: ${error.message}`);
}

// ── Chunk operations ──────────────────────────────────────────────────────────

export async function insertChunks(chunks: DocumentChunk[]): Promise<void> {
  const orgId = pipelineOrgId();
  const BATCH = 100;

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
        section_hierarchy: c.section_path,   // string[] stored as jsonb array
        court_name:        c.metadata.court ?? null,
        court_type:        c.metadata.court ? mapCourtType(c.metadata.court) : null,
        jurisdiction:      c.metadata.jurisdiction ?? null,
        citation:          c.metadata.full_citation ?? null,
        year:              c.metadata.year ?? null,
        document_type:     mapDocumentType(c.metadata.document_type),
        legal_tags:        c.metadata.concept_tags ?? [],
        acts_sections:     c.metadata.acts_referenced.map(a => ({ act_name: a, sections: [] })),
        is_public:         true,
      }))
    );
    if (error) throw new Error(`insertChunks batch ${i} failed: ${error.message}`);
  }
}

export async function updateChunkEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  const { error } = await supabase
    .from('document_chunks')
    .update({ embedding })
    .eq('id', chunkId);
  if (error) throw new Error(`updateChunkEmbedding failed: ${error.message}`);
}
