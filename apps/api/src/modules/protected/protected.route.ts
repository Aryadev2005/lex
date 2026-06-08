import type { FastifyInstance } from 'fastify';

export async function protectedRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/protected/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.user;

      const { data: userRow, error } = await fastify.supabase
        .from('users')
        .select('id, email, full_name, role, org_id, created_at')
        .eq('id', sub)
        .single();

      if (error || !userRow) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
          statusCode: 404,
        });
      }

      return reply.status(200).send({ user: userRow });
    },
  );
}
