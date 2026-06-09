import ws from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as Record<string, unknown>)['WebSocket'] = ws;
}
import { config } from 'dotenv';
config({ path: '/Users/aryadevchatterjee/Documents/LEX/data/.env' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, { auth: { persistSession: false } });

async function main() {
  // Select 1 row to see what columns exist
  const { data: d, error: e } = await sb.from('documents').select('*').limit(1);
  if (e) console.log('documents err:', e.message);
  else console.log('documents cols:', d ? (d.length > 0 ? Object.keys(d[0] as object) : '(empty table, no schema info)') : 'null');

  const { data: dc, error: dce } = await sb.from('document_chunks').select('*').limit(1);
  if (dce) console.log('doc_chunks err:', dce.message);
  else console.log('doc_chunks cols:', dc ? (dc.length > 0 ? Object.keys(dc[0] as object) : '(empty table)') : 'null');
}
main().catch(console.error);
