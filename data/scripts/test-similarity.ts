import ws from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as Record<string, unknown>)['WebSocket'] = ws;
}
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), 'data/.env') });
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

const QUERIES = [
  "What is the test for reasonable classification under Article 14?",
  "When can a writ of mandamus be issued against a private body?",
  "What is the basic structure doctrine?",
];

for (const q of QUERIES) {
  const resp = await openai.embeddings.create({ model: 'text-embedding-3-large', input: q, dimensions: 3072 });
  const emb = resp.data[0]!.embedding;
  
  // Call without threshold — pass similarity_threshold=0.0
  const { data, error } = await sb.rpc('hybrid_search', {
    query_text: q,
    query_embedding: emb,
    match_count: 5,
    rrf_k: 60,
    include_public: true,
    similarity_threshold: 0.0,
  });
  
  if (error) { console.error(q, error.message); continue; }
  const rows = (data as any[]) ?? [];
  console.log(`\n"${q.slice(0,60)}..."`);
  rows.forEach((r: any, i: number) => {
    console.log(`  ${i+1}. vec=${r.vector_score?.toFixed(4)} rrf=${r.rrf_score?.toFixed(4)} | ${r.content?.slice(0,80)}`);
  });
}
