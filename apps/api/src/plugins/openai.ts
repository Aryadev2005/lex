import OpenAI from 'openai';
import fp from 'fastify-plugin';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    openai: OpenAI;
  }
}

export const registerOpenAI = fp(async function openaiPlugin(fastify) {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  fastify.decorate('openai', client);
});
