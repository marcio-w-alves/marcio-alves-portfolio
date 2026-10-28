import { createHash } from 'node:crypto';
import { buildCorpus } from '@/core/knowledge/corpus';
import {
  corpusHash,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type KnowledgeIndex,
} from '@/infrastructure/retrieval/index-spec';
import { fixtureKnowledge } from './knowledge';

/**
 * A unit vector seeded by the passage's id: stable from run to run, and as
 * unrelated to every other passage as two random directions in 512
 * dimensions are, so a query equal to one passage's vector finds that one.
 */
function seededVector(id: string): number[] {
  let state = createHash('sha256').update(id).digest().readUInt32BE(0);
  const raw = Array.from({ length: EMBEDDING_DIMENSIONS }, () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31 - 0.5;
  });
  const length = Math.hypot(...raw);
  return raw.map((value) => Math.round((value / length) * 1e5) / 1e5);
}

/**
 * The fixture's retrieval index, built without a model: the real corpus hash
 * over seeded vectors. It stands in for the owner's index under
 * `pnpm test:fork`, and needs no key to rebuild (`pnpm fixture:index`).
 */
export function buildFixtureIndex(): KnowledgeIndex {
  const corpus = buildCorpus(fixtureKnowledge);
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    corpusHash: corpusHash(corpus),
    vectors: Object.fromEntries(corpus.map(({ id }) => [id, seededVector(id)])),
  };
}
