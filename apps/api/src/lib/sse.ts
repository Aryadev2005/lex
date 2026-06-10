import type { ServerResponse } from 'http';

export const SIMILARITY_THRESHOLD = 0.50;

export function sseStart(raw: ServerResponse): void {
  raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  raw.setHeader('Cache-Control', 'no-cache, no-transform');
  raw.setHeader('Connection', 'keep-alive');
  raw.setHeader('X-Accel-Buffering', 'no');
  raw.flushHeaders();
}

export function sseWrite(raw: ServerResponse, event: Record<string, unknown>): void {
  raw.write(`data: ${JSON.stringify(event)}\n\n`);
}
