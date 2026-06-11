import OpenAI from 'openai';
import { type HybridChunk } from '../../lib/rag.js';
import { SIMILARITY_THRESHOLD as _SIMILARITY_THRESHOLD } from '../../lib/sse.js';

export interface ResearchMemoSource {
  chunk_id: string;
  citation: string;
  court: string;
  year: number;
  excerpt: string;
  similarity: number;
}

const SYSTEM_PROMPT = `You are LEX, an expert Indian legal research assistant. You have been provided verified source chunks from Indian court judgments and legislation.
STRICT RULES:
1. Base your answer ONLY on the provided sources. Never hallucinate.
2. Every factual claim MUST cite the source using [Source N] notation.
3. Structure your response in three sections:
   ## Direct Answer
   ## Supporting Precedents
   ## Relevant Statutory Provisions
4. If sources are insufficient, say so explicitly. Do not invent law.`;

export async function* streamResearchMemo(
  openai: OpenAI,
  query: string,
  chunks: HybridChunk[],
): AsyncGenerator<string> {
  const userMessage =
    `Query: ${query}\n\nSources:\n` +
    chunks
      .map((c, i) => `[Source ${i + 1}] ${c.citation} (${c.court}, ${c.year})\n${c.content}`)
      .join('\n\n---\n\n');

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export async function saveDeclinedQuery(
  supabase: any,
  userId: string,
  orgId: string | null,
  query: string,
  jurisdiction: string | undefined,
  topSimilarity: number,
  chunkCount: number,
): Promise<void> {
  try {
    await supabase.from('agent_sessions').insert({
      org_id: orgId,
      user_id: userId,
      session_type: 'research_declined',
      status: 'declined',
      input_query: query,
      input_metadata: { jurisdiction: jurisdiction ?? null },
      final_output: {
        reason: 'insufficient_grounded_sources',
        top_similarity: topSimilarity,
        chunks_found: chunkCount,
        threshold: 0.50,
      },
      total_tokens: 0,
    });
  } catch (err) {
    console.error('saveDeclinedQuery failed:', err);
  }
}

export async function saveResearchSession(
  supabase: any,
  userId: string,
  orgId: string | null,
  query: string,
  jurisdiction: string | undefined,
  fullMemo: string,
  sources: HybridChunk[],
  tokensUsed: number,
): Promise<void> {
  const queryHash = Buffer.from(query + (jurisdiction ?? ''))
    .toString('base64')
    .slice(0, 64);

  try {
    await Promise.all([
      supabase.from('agent_sessions').insert({
        org_id: orgId,
        user_id: userId,
        session_type: 'research',
        input_query: query,
        input_metadata: { jurisdiction: jurisdiction ?? null },
        final_output: { memo: fullMemo, source_count: sources.length },
        status: 'completed',
        total_tokens: tokensUsed,
      }),
      supabase.from('research_cache').upsert({
        org_id: orgId,
        query_text: query,
        query_hash: queryHash,
        result_text: fullMemo,
        source_chunk_ids: sources.map((c) => c.chunk_id),
        jurisdiction_filter: jurisdiction ?? null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    ]);
  } catch (err) {
    console.error('saveResearchSession failed:', err);
  }
}
