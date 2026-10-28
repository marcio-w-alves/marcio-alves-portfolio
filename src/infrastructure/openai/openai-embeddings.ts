import type OpenAI from 'openai';
import type { EmbeddingPort } from '@/core/assistant/ports/embedding.port';

/**
 * A question's embedding comes back in well under a second; an answer waits
 * on it, so a provider that stalls is given up on quickly and not retried.
 */
export const EMBEDDINGS_TIMEOUT_MS = 4_000;

export class EmbeddingsTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The embeddings call took longer than ${String(timeoutMs)} ms.`);
    this.name = 'EmbeddingsTimeoutError';
  }
}

interface Options {
  readonly client: OpenAI;
  readonly model: string;
  readonly dimensions: number;
  readonly timeoutMs?: number;
}

export function createOpenAIEmbeddings({
  client,
  model,
  dimensions,
  timeoutMs = EMBEDDINGS_TIMEOUT_MS,
}: Options): EmbeddingPort {
  return {
    async embed(texts, signal) {
      // The client's own timeout stops at the response headers; this one
      // also bounds a body that never finishes.
      const deadline = AbortSignal.timeout(timeoutMs);
      try {
        const response = await client.embeddings.create(
          { model, input: [...texts], dimensions },
          { signal: signal ? AbortSignal.any([signal, deadline]) : deadline, maxRetries: 0 },
        );
        // The API documents results by `index`, not by position; order them explicitly.
        return [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
      } catch (error) {
        // The SDK reports either abort as a generic error; name which one it was,
        // so a visitor leaving is not counted against the provider, and a
        // deadline is.
        signal?.throwIfAborted();
        if (deadline.aborted) throw new EmbeddingsTimeoutError(timeoutMs);
        throw error;
      }
    },
  };
}
