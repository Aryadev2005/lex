import OpenAI from 'openai';

export interface HybridChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  citation: string;
  court: string;
  jurisdiction: string;
  year: number;
  section_path: string[];
  legal_tags: string[];
  vector_score: number;
  rrf_score: number;
}

export async function hybridSearch(
  supabase: any,
  openai: OpenAI,
  query: string,
  matchCount: number = 12,
  documentTypes?: string[],
): Promise<HybridChunk[]> {
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
    dimensions: 3072,
  });

  const embedding = embeddingResponse.data[0]!.embedding;

  const { data, error } = await supabase.rpc('hybrid_search', {
    p_query_text: query,
    p_query_embedding: embedding,
    p_match_count: matchCount,
    p_document_types: documentTypes ?? null,
  });

  if (error) {
    throw new Error(`hybrid_search RPC failed: ${error.message}`);
  }

  return (data as any[]).map((row): HybridChunk => {
    const rawPath = row.section_hierarchy;
    const section_path: string[] = Array.isArray(rawPath)
      ? rawPath.map(String)
      : [];

    return {
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      content: row.content,
      citation: row.citation,
      court: row.court,
      jurisdiction: row.jurisdiction,
      year: row.year,
      section_path,
      legal_tags: Array.isArray(row.legal_tags) ? row.legal_tags : [],
      vector_score: row.similarity ?? row.vector_score ?? 0,
      rrf_score: row.rrf_score ?? 0,
    };
  });
}
