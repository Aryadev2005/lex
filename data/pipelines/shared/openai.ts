import OpenAI from 'openai';
import pRetry, { AbortError } from 'p-retry';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gpt4oMiniLimiter, embeddingLimiter } from './rate-limiter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

const apiKey = process.env['OPENAI_API_KEY'];
if (!apiKey) {
  throw new Error('Missing required env var: OPENAI_API_KEY must be set in data/.env');
}

export const openaiClient = new OpenAI({ apiKey });

export async function enrichDocument(
  prompt: string,
  systemPrompt: string,
  schema: Record<string, unknown>
): Promise<unknown> {
  return pRetry(
    async attempt => {
      await gpt4oMiniLimiter.waitForRequest(8_000);

      let response: OpenAI.Chat.ChatCompletion;
      try {
        response = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini-2024-07-18',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'enrichment_output',
              strict: true,
              schema,
            },
          },
        });
      } catch (err) {
        const apiError = err as { status?: number; headers?: Record<string, string>; message?: string };
        if (apiError.status === 429) {
          const retryAfter = apiError.headers?.['retry-after'];
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * Math.pow(2, attempt);
          await sleep(waitMs);
          throw err;
        }
        if (apiError.status !== undefined && apiError.status >= 400 && apiError.status < 500 && apiError.status !== 429) {
          throw new AbortError(`Non-retryable OpenAI error ${apiError.status}: ${apiError.message}`);
        }
        throw err;
      }

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI enrichment');

      gpt4oMiniLimiter.recordUsage(response.usage?.total_tokens ?? 0);
      return JSON.parse(content) as unknown;
    },
    {
      retries: 5,
      minTimeout: 1_000,
      maxTimeout: 16_000,
      factor: 2,
    }
  );
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > 100) {
    throw new Error(`embedTexts accepts at most 100 texts per call, got ${texts.length}`);
  }

  return pRetry(
    async attempt => {
      await embeddingLimiter.waitForRequest(texts.length * 1_000);

      let response: OpenAI.Embeddings.CreateEmbeddingResponse;
      try {
        response = await openaiClient.embeddings.create({
          model: 'text-embedding-3-large',
          input: texts,
          dimensions: 3072,
        });
      } catch (err) {
        const apiError = err as { status?: number; headers?: Record<string, string>; message?: string };
        if (apiError.status === 429) {
          const retryAfter = apiError.headers?.['retry-after'];
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * Math.pow(2, attempt);
          await sleep(waitMs);
          throw err;
        }
        if (apiError.status !== undefined && apiError.status >= 400 && apiError.status < 500 && apiError.status !== 429) {
          throw new AbortError(`Non-retryable OpenAI error ${apiError.status}: ${apiError.message}`);
        }
        throw err;
      }

      embeddingLimiter.recordUsage(response.usage.total_tokens);

      const sorted = response.data.sort((a, b) => a.index - b.index);
      return sorted.map(e => e.embedding);
    },
    {
      retries: 5,
      minTimeout: 1_000,
      maxTimeout: 16_000,
      factor: 2,
    }
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
