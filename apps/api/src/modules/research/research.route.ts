import type { FastifyInstance } from 'fastify';
import { researchQuerySchema } from './research.schema.js';
import { hybridSearch } from '../../lib/rag.js';
import { sseStart, sseWrite, SIMILARITY_THRESHOLD } from '../../lib/sse.js';
import { streamResearchMemo, saveResearchSession } from './research.service.js';

export async function researchRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/research/query',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = researchQuerySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const { query, jurisdiction, match_count } = parsed.data;
      const { sub: userId, org_id } = request.user;

      sseStart(reply.raw);

      let chunks;
      try {
        chunks = await hybridSearch(fastify.supabase, fastify.openai, query, match_count);
      } catch (err) {
        sseWrite(reply.raw, { type: 'error', message: (err as Error).message });
        reply.raw.end();
        return;
      }

      const filtered = chunks.filter((c) => c.vector_score >= SIMILARITY_THRESHOLD);

      if (filtered.length === 0) {
        sseWrite(reply.raw, {
          type: 'insufficient_sources',
          message: 'Insufficient grounded sources found for this query.',
        });
        reply.raw.end();
        return;
      }

      sseWrite(reply.raw, {
        type: 'sources',
        sources: filtered.map((c) => ({
          chunk_id: c.chunk_id,
          citation: c.citation,
          court: c.court,
          year: c.year,
          excerpt: c.content.slice(0, 200),
        })),
      });

      let fullMemo = '';
      let tokensUsed = 0;

      for await (const token of streamResearchMemo(fastify.openai, query, filtered)) {
        sseWrite(reply.raw, { type: 'token', content: token });
        fullMemo += token;
      }

      sseWrite(reply.raw, { type: 'done', source_count: filtered.length });
      reply.raw.end();

      saveResearchSession(
        fastify.supabase,
        userId,
        org_id,
        query,
        jurisdiction,
        fullMemo,
        filtered,
        tokensUsed,
      ).catch((err) => fastify.log.error(err));
    },
  );
}
