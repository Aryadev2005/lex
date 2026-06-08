import type { FastifyInstance } from 'fastify';
import { registerBodySchema, loginBodySchema } from './auth.schema.js';
import { registerUser, loginUser } from './auth.service.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Validation error',
        statusCode: 400,
      });
    }

    const result = await registerUser(fastify, fastify.supabase, parsed.data);
    return reply.status(201).send(result);
  });

  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Validation error',
        statusCode: 400,
      });
    }

    const result = await loginUser(fastify, fastify.supabase, parsed.data);
    return reply.status(200).send(result);
  });
}
