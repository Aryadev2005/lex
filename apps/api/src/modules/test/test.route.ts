import type { FastifyInstance } from 'fastify';

export async function testRoutes(fastify: FastifyInstance) {
  fastify.get('/test/db', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    try {
      const { count, error } = await fastify.supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return reply.status(200).send({
          connected: false,
          error: error.message,
        });
      }

      return reply.status(200).send({
        table: 'organizations',
        count: count ?? 0,
        connected: true,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(200).send({ connected: false, error: message });
    }
  });
}
