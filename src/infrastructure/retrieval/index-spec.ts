import { createHash } from 'node:crypto';
import type { KnowledgeChunk } from '@/core/knowledge/corpus';

/**
 * What the committed index was built with. The query embedding at runtime
 * must use exactly the same model and dimensions, or the similarities are
 * meaningless — so both sides read them from here.
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 512;

export interface KnowledgeIndex {
  readonly model: string;
  readonly dimensions: number;
  /** Hash of the corpus the vectors were computed from. */
  readonly corpusHash: string;
  readonly vectors: Readonly<Record<string, readonly number[]>>;
}

/** Changes whenever a passage, its id, the model or the dimensions change. */
export function corpusHash(chunks: readonly KnowledgeChunk[]): string {
  const payload = JSON.stringify({
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    chunks: chunks.map(({ id, text }) => [id, text]),
  });
  return createHash('sha256').update(payload).digest('hex');
}
