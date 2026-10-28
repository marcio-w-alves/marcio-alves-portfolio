import type { ChunkCategory } from '@/core/knowledge/corpus';
import type { AnswerSource } from '../assistant-event';

export interface Passage {
  readonly id: string;
  readonly category: ChunkCategory;
  readonly text: string;
  readonly source: AnswerSource;
  /** Cosine similarity to the query, from -1 to 1. */
  readonly score: number;
}

export interface KnowledgeSearchQuery {
  readonly query: string;
  readonly limit: number;
  readonly category?: ChunkCategory;
  /** The visitor's request; the search stops when it is abandoned. */
  readonly signal?: AbortSignal;
}

/** Semantic search over the knowledge base's passages. */
export interface KnowledgeSearchPort {
  /**
   * Best matches first. Empty when nothing is relevant enough to be worth
   * reading; rejects when the search cannot run right now.
   */
  search(query: KnowledgeSearchQuery): Promise<Passage[]>;
}
