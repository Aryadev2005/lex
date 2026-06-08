import { createSupabaseAdminClient } from '@lex/db';
import type { FastifyInstance } from 'fastify';
import type { RegisterBody, LoginBody } from './auth.schema.js';
import { env } from '../../env.js';

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function registerUser(
  fastify: FastifyInstance,
  supabase: SupabaseClient,
  body: RegisterBody,
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.toLowerCase().includes('already') || error.status === 422) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    }
    throw Object.assign(new Error(error.message), { statusCode: 400 });
  }

  const userId = data.user.id;

  const { error: insertError } = await supabase.from('users').insert({
    id: userId,
    email: body.email,
    full_name: body.full_name,
    role: 'attorney',
    is_active: true,
  });

  if (insertError) {
    fastify.log.error({ err: insertError }, 'Failed to insert user row');
    throw Object.assign(new Error('Failed to create user profile'), { statusCode: 500 });
  }

  const payload = { sub: userId, email: body.email, role: 'attorney' as const, org_id: null };
  const token = fastify.jwt.sign(payload, { expiresIn: env.JWT_EXPIRES_IN });

  return {
    token,
    user: { id: userId, email: body.email, full_name: body.full_name, role: 'attorney' as const },
  };
}

export async function loginUser(
  fastify: FastifyInstance,
  supabase: SupabaseClient,
  body: LoginBody,
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error || !data.user) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const { data: userRow, error: fetchError } = await supabase
    .from('users')
    .select('id, email, full_name, role, org_id')
    .eq('id', data.user.id)
    .single();

  if (fetchError || !userRow) {
    throw Object.assign(new Error('User profile not found'), { statusCode: 404 });
  }

  const payload = {
    sub: userRow.id as string,
    email: userRow.email as string,
    role: userRow.role as 'attorney',
    org_id: (userRow.org_id as string | null) ?? null,
  };
  const token = fastify.jwt.sign(payload, { expiresIn: env.JWT_EXPIRES_IN });

  return { token, user: userRow };
}
