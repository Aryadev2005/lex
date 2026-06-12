import type { ServerResponse } from 'http';
import type { FastifyReply } from 'fastify';

export const SIMILARITY_THRESHOLD = 0.50;

// Headers that must not be copied to the SSE raw response
const SSE_EXCLUDED_HEADERS = new Set([
  'content-length',
  'transfer-encoding',
  'content-encoding',
]);

export function sseStart(reply: FastifyReply): void {
  // Fastify's plugin lifecycle (including @fastify/cors) sets headers via
  // reply.header() which stores them in Fastify's internal kReplyHeaders buffer.
  // That buffer is only written to reply.raw inside reply.send().
  // Since SSE routes never call reply.send(), we must manually propagate those
  // buffered headers to reply.raw before flushing — otherwise CORS headers are lost.
  const bufferedHeaders = reply.getHeaders();
  for (const [key, val] of Object.entries(bufferedHeaders)) {
    if (val !== undefined && !SSE_EXCLUDED_HEADERS.has(key.toLowerCase())) {
      reply.raw.setHeader(key, val as string | string[] | number);
    }
  }

  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  // writeHead sends the status line + all accumulated raw headers immediately
  reply.raw.writeHead(200);
}

export function sseWrite(raw: ServerResponse, event: Record<string, unknown>): void {
  raw.write(`data: ${JSON.stringify(event)}\n\n`);
}
