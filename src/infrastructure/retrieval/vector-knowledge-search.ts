import { citation } from '@/core/assistant/citations';
import type { EmbeddingPort } from '@/core/assistant/ports/embedding.port';
import type { KnowledgeSearchPort, Passage } from '@/core/assistant/ports/knowledge-search.port';
import type { KnowledgeChunk } from '@/core/knowledge/corpus';
import { guard, type CircuitBreaker } from '../resilience/circuit-breaker';
import type { KnowledgeIndex } from './index-spec';

/**
 * Below this similarity a passage is noise for this corpus. Without a floor,
 * an off-topic question would still get "the five least irrelevant passages",
 * and the model would read them as context.
 *
 * Calibrated on real embeddings, not guessed: off-topic questions (weather,
 * recipes, sport, physics, poetry) peaked at 0.18, while the best on-topic
 * passage scored 0.30–0.55 in English and Portuguese, and relevant secondary
 * passages went down to about 0.25. A first guess of 0.3 would have dropped
 * the Roots leadership passages from "tell me about his leadership".
 */
export const RELEVANCE_FLOOR = 0.22;

/**
 * The knowledge-base notes are long Portuguese passages; on a terse or
 * Portuguese query they outscore the résumé's short English statements and
 * would crowd them out ("acessibilidade" once returned five notes on access
 * control and no Toptal accessibility work). So, unless a category is asked
 * for, the résumé keeps the whole limit and the notes add at most this many.
 */
export const NOTES_SHARE = 3;

export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

interface Options {
  readonly embeddings: EmbeddingPort;
  readonly index: KnowledgeIndex;
  readonly corpus: readonly KnowledgeChunk[];
  /** Its own, so an embeddings outage never opens the chat model's circuit. */
  readonly breaker: CircuitBreaker;
}

/**
 * Exhaustive similarity over the committed index. Seventy vectors make an
 * approximate-nearest-neighbour structure pure overhead.
 */
export function createVectorKnowledgeSearch({
  embeddings,
  index,
  corpus,
  breaker,
}: Options): KnowledgeSearchPort {
  return {
    async search({ query, limit, category, signal }) {
      const [vector] = await guard(breaker, () => embeddings.embed([query], signal));
      if (!vector) return [];
      const ranked = corpus
        .filter((chunk) => !category || chunk.category === category)
        .map((chunk): Passage => ({
          id: chunk.id,
          category: chunk.category,
          text: chunk.text,
          source: citation(chunk.source),
          score: cosine(vector, index.vectors[chunk.id] ?? []),
        }))
        .filter((passage) => passage.score >= RELEVANCE_FLOOR)
        .sort((a, b) => b.score - a.score);
      if (category) return ranked.slice(0, limit);
      const record = ranked.filter((passage) => passage.category !== 'notes').slice(0, limit);
      const notes = ranked
        .filter((passage) => passage.category === 'notes')
        .slice(0, Math.min(NOTES_SHARE, limit));
      return [...record, ...notes].sort((a, b) => b.score - a.score);
    },
  };
}
