import pRetry, { AbortError } from 'p-retry';
import { openaiClient } from '../shared/openai.js';
import { embeddingLimiter } from '../shared/rate-limiter.js';
import { updateChunkEmbedding } from '../shared/db.js';
import type { EmbeddingInput } from '../shared/types.js';

const EMBEDDING_DIM = 3072;
const DEFAULT_BATCH_SIZE = 100;

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

export async function generateEmbeddingBatch(
  inputs: EmbeddingInput[]
): Promise<Array<{ chunk_id: string; embedding: number[] }>> {
  if (inputs.length > DEFAULT_BATCH_SIZE) {
    throw new Error(
      `generateEmbeddingBatch: batch size ${inputs.length} exceeds maximum ${DEFAULT_BATCH_SIZE}`
    );
  }
  if (inputs.length === 0) return [];

  const augmented_texts = inputs.map(i => i.augmented_text);
  const estimatedTokens = inputs.reduce((sum, i) => sum + i.token_count, 0);

  return pRetry(
    async attempt => {
      await embeddingLimiter.waitForRequest(estimatedTokens);

      let response: Awaited<ReturnType<typeof openaiClient.embeddings.create>>;
      try {
        response = await openaiClient.embeddings.create({
          model: 'text-embedding-3-large',
          input: augmented_texts,
          dimensions: EMBEDDING_DIM,
        });
      } catch (err) {
        const apiError = err as {
          status?: number;
          headers?: Record<string, string>;
          message?: string;
        };
        if (apiError.status === 429) {
          const retryAfter = apiError.headers?.['retry-after'];
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : 1000 * Math.pow(2, attempt);
          await sleep(waitMs);
          throw err;
        }
        if (
          apiError.status !== undefined &&
          apiError.status >= 400 &&
          apiError.status < 500 &&
          apiError.status !== 429
        ) {
          throw new AbortError(
            `Non-retryable OpenAI error ${apiError.status}: ${apiError.message}`
          );
        }
        throw err;
      }

      embeddingLimiter.recordUsage(response.usage.total_tokens);

      const sorted = response.data.sort((a, b) => a.index - b.index);

      return sorted.map((e, idx) => {
        if (e.embedding.length !== EMBEDDING_DIM) {
          throw new AbortError(
            `Embedding at index ${idx} has dimension ${e.embedding.length}, expected ${EMBEDDING_DIM}`
          );
        }
        return { chunk_id: inputs[idx]!.chunk_id, embedding: e.embedding };
      });
    },
    {
      retries: 5,
      minTimeout: 1_000,
      maxTimeout: 16_000,
      factor: 2,
    }
  );
}

export async function processEmbeddingBatches(
  inputs: EmbeddingInput[],
  onBatchComplete?: (batchIndex: number, total: number) => void | Promise<void>,
  batchSize = DEFAULT_BATCH_SIZE
): Promise<void> {
  const batches: EmbeddingInput[][] = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    batches.push(inputs.slice(i, i + batchSize));
  }

  const total = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;

    const results = await generateEmbeddingBatch(batch);

    for (const { chunk_id, embedding } of results) {
      await updateChunkEmbedding(chunk_id, embedding);
    }

    if (onBatchComplete) await onBatchComplete(i, total);

    if (i < batches.length - 1) {
      await sleep(100);
    }
  }
}
