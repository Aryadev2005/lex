import { createClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const ws = require('ws') as any;

// Temporary stub — replace with `supabase gen types typescript` output once
// the Supabase project is linked.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

export function createSupabaseClient(url: string, anonKey: string) {
  return createClient<Database>(url, anonKey, {
    realtime: { transport: ws },
  });
}

export function createSupabaseAdminClient(url: string, serviceRoleKey: string) {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: { transport: ws },
  });
}
