/** Turns text into vectors comparable by cosine similarity. */
export interface EmbeddingPort {
  /** One vector per input, in input order. Rejects once `signal` aborts. */
  embed(texts: readonly string[], signal?: AbortSignal): Promise<number[][]>;
}
