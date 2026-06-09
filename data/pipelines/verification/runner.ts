import { openaiClient } from '../shared/openai.js';
import { supabase } from '../shared/db.js';
import type { TestQuery } from '../../seeds/test-queries.js';

// rrf_score max ≈ 1/(k+1); use vector_score (cosine similarity) for the threshold
// 0.50 is appropriate for text-embedding-3-large on legal text (cross-doc similarity ~0.55-0.75)
const SIMILARITY_THRESHOLD = 0.50;
const EMBEDDING_DIM = 3072;

// Raw row returned by the actual hybrid_search function
interface HybridSearchRow {
  chunk_id: string;
  document_id: string;
  content: string;
  citation: string | null;
  court_name: string | null;
  jurisdiction: string | null;
  year: number | null;
  chunk_type: string;
  section_hierarchy: unknown;    // jsonb string[]
  legal_tags: string[] | null;
  rrf_score: number;
  vector_score: number;
  fts_score: number;
}

export interface QueryResult {
  query: TestQuery;
  results: Array<{
    chunk_id: string;
    document_id: string;
    content: string;
    section_path: string[];
    court: string;
    year: number;
    similarity: number;        // vector_score (cosine similarity)
    full_citation: string;
    rank: number;
  }>;
  latency_ms: number;
  top_similarity: number;
  clears_threshold: boolean;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x));
  return [];
}

export async function runQuery(query: TestQuery): Promise<QueryResult> {
  const start = Date.now();

  // 1. Embed the query
  const embedResponse = await openaiClient.embeddings.create({
    model: 'text-embedding-3-large',
    input: query.query,
    dimensions: EMBEDDING_DIM,
  });

  const embedding = embedResponse.data[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding dimension for query ${query.id}`);
  }

  // 2. Call the actual hybrid_search RPC
  // similarity_threshold=0: let HNSW return top results regardless of score;
  // we apply our own threshold check on the returned vector_score.
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_text:           query.query,
    query_embedding:      embedding,
    match_count:          12,
    rrf_k:                60,
    include_public:       true,
    similarity_threshold: 0,
  });

  if (error) {
    throw new Error(`hybrid_search failed for ${query.id}: ${error.message}`);
  }

  const latency_ms = Date.now() - start;
  const rows = (Array.isArray(data) ? data : []) as HybridSearchRow[];

  // 3. Map rows — use vector_score as our similarity metric (0–1 cosine range)
  const results = rows.map((row, idx) => ({
    chunk_id:     row.chunk_id,
    document_id:  row.document_id,
    content:      row.content,
    section_path: toStringArray(row.section_hierarchy),
    court:        row.court_name   ?? '',
    year:         row.year         ?? 0,
    similarity:   row.vector_score ?? 0,
    full_citation: row.citation    ?? '',
    rank:         idx + 1,
  }));

  const top_similarity = results[0]?.similarity ?? 0;

  return {
    query,
    results,
    latency_ms,
    top_similarity,
    clears_threshold: top_similarity >= SIMILARITY_THRESHOLD,
  };
}
