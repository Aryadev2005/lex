import type { FastifyInstance } from 'fastify';
import { sseStart, sseWrite } from '../../lib/sse.js';
import { draftGenerateSchema } from './draft.schema.js';
import { DRAFT_TEMPLATES } from './draft.templates.js';
import { streamDraftDocument, findTemplate } from './draft.service.js';

export async function draftRoutes(fastify: FastifyInstance) {
  fastify.get('/api/draft/templates', async (_request, reply) => {
    return reply.send({
      templates: DRAFT_TEMPLATES.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        document_type: t.document_type,
        court_type: t.court_type,
      })),
    });
  });

  fastify.post(
    '/api/draft/generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = draftGenerateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map(i => i.message).join(', '),
        });
      }

      const { template_id, situation_description, additional_facts = {} } = parsed.data;

      const template = findTemplate(template_id);
      if (!template) {
        return reply.status(404).send({ success: false, error: 'Template not found' });
      }

      sseStart(reply);
      sseWrite(reply.raw, { type: 'template', template_name: template.name });

      try {
        for await (const token of streamDraftDocument(
          fastify.openai,
          template,
          situation_description,
          additional_facts,
        )) {
          sseWrite(reply.raw, { type: 'token', content: token });
        }
      } catch (err) {
        sseWrite(reply.raw, {
          type: 'error',
          message: (err as Error).message ?? 'Draft generation failed',
        });
      }

      sseWrite(reply.raw, { type: 'done' });
      reply.raw.end();
    },
  );
}
