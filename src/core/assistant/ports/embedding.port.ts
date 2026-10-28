/** Turns text into vectors comparable by cosine similarity. */
export interface EmbeddingPort {
  /** One vector per input, in input order. */
  embed(texts: readonly string[]): Promise<number[][]>;
}
