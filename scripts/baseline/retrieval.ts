import { buildCorpus } from '../../src/core/knowledge/corpus';
import type { KnowledgeSource } from '../../src/core/knowledge/schema';
import { createCircuitBreaker } from '../../src/infrastructure/resilience/circuit-breaker';
import type { KnowledgeIndex } from '../../src/infrastructure/retrieval/index-spec';
import { createVectorKnowledgeSearch } from '../../src/infrastructure/retrieval/vector-knowledge-search';
import type { RetrievalResult } from './inputs';

/** What the assistant's search action asks for. */
const LIMIT = 5;

export interface ProbeVectors {
  readonly vectors: Readonly<Record<string, readonly number[]>>;
}

/**
 * The site's own search over the checkout's index, run offline: each probe's
 * stored vector stands in for the embedding call. A probe without a vector
 * has no result, which the comparison reports.
 */
export async function retrieve(
  record: KnowledgeSource,
  index: KnowledgeIndex,
  { vectors }: ProbeVectors,
  probes: readonly string[],
): Promise<RetrievalResult[]> {
  const corpus = buildCorpus(record);
  return Promise.all(
    probes.map(async (probe) => {
      const vector = vectors[probe];
      if (!vector) return { probe, results: null };
      const search = createVectorKnowledgeSearch({
        embeddings: { embed: () => Promise.resolve([[...vector]]) },
        index,
        corpus,
        citation: (source) => ({ id: source, label: source }),
        breaker: createCircuitBreaker({ failureThreshold: 1, cooldownMs: 0 }),
      });
      const passages = await search.search({ query: probe, limit: LIMIT });
      return {
        probe,
        results: passages.map(({ id, category, score }) => ({ id, category, score })),
      };
    }),
  );
}
