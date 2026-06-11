import type { FastifyInstance } from 'fastify';
import { sseStart, sseWrite } from '../../lib/sse.js';
import { contractAnalysisSchema, redlineBodySchema } from './contract.schema.js';
import { contractGraph } from './contract.graph.js';
import { buildRedlineDocx } from './contract.redline.js';
import type { ContractAnalysisResult } from './contract.types.js';

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

  fastify.post(
    '/api/contract/redline',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = redlineBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const analysis = parsed.data.analysis as ContractAnalysisResult;

      if (analysis.risks.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No risks found to include in redline',
        });
      }

      let buffer: Buffer;
      try {
        buffer = await buildRedlineDocx(analysis);
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: `DOCX generation failed: ${(err as Error).message}`,
        });
      }

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .header('Content-Disposition', 'attachment; filename="lex-contract-redline.docx"')
        .send(buffer);
    },
  );
}
