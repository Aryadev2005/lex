import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createSupabaseAdminClient } from '@lex/db';
import { env } from '../env.js';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseAdminClient;
  }
}

async function supabasePlugin(fastify: FastifyInstance) {
  const client = createSupabaseAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastify.decorate('supabase', client as any);
}

export const registerSupabase = fp(supabasePlugin);
