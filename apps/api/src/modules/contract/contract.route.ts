import type { FastifyInstance } from 'fastify';
import { sseStart, sseWrite } from '../../lib/sse.js';
import { contractAnalysisSchema } from './contract.schema.js';
import { contractGraph } from './contract.graph.js';

export async function contractRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/contract/analyze',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = contractAnalysisSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const { document_text } = parsed.data;
      sseStart(reply.raw);

      try {
        await contractGraph.invoke({
          documentText: document_text,
          onEvent: (event) => sseWrite(reply.raw, event as Record<string, unknown>),
          supabase: fastify.supabase,
          openai: fastify.openai,
        });
      } catch (err) {
        sseWrite(reply.raw, {
          type: 'error',
          message: (err as Error).message ?? 'Contract analysis failed',
        });
      }

      reply.raw.end();
    },
  );
}
