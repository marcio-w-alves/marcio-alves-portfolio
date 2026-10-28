import type { EmbeddingPort } from '@/core/assistant/ports/embedding.port';
import type { KnowledgeSearchPort, Passage } from '@/core/assistant/ports/knowledge-search.port';
import type { KnowledgeChunk } from '@/core/knowledge/corpus';
import { sourceOf } from '@/core/knowledge/knowledge-base';
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
}

/**
 * Exhaustive similarity over the committed index. Seventy vectors make an
 * approximate-nearest-neighbour structure pure overhead.
 */
export function createVectorKnowledgeSearch({
  embeddings,
  index,
  corpus,
}: Options): KnowledgeSearchPort {
  return {
    async search({ query, limit, category }) {
      const [vector] = await embeddings.embed([query]);
      if (!vector) return [];
      return corpus
        .filter((chunk) => !category || chunk.category === category)
        .map((chunk): Passage => ({
          id: chunk.id,
          category: chunk.category,
          text: chunk.text,
          source: sourceOf(chunk.source),
          score: cosine(vector, index.vectors[chunk.id] ?? []),
        }))
        .filter((passage) => passage.score >= RELEVANCE_FLOOR)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
