import { createHash } from 'node:crypto';
import { buildCorpus } from '../../src/core/knowledge/corpus';
import type { KnowledgeSource } from '../../src/core/knowledge/schema';
import {
  corpusHash,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from '../../src/infrastructure/retrieval/index-spec';

/**
 * A retrieval index built without a model, for a profile that must build with
 * no key — the shipped example: the real corpus hash over vectors seeded by
 * each passage's id. Stable from run to run, and each vector as unrelated to
 * the others as two random directions in 512 dimensions are, so a query equal
 * to one passage's vector finds that one.
 */

function seededVector(seed: string): number[] {
  let state = createHash('sha256').update(seed).digest().readUInt32BE(0);
  const raw = Array.from({ length: EMBEDDING_DIMENSIONS }, () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31 - 0.5;
  });
  const length = Math.hypot(...raw);
  return raw.map((value) => Math.round((value / length) * 1e5) / 1e5);
}

/** `generated/knowledge-index.json`, as its bytes. */
export function seededIndex(knowledge: KnowledgeSource): string {
  const corpus = buildCorpus(knowledge);
  const index = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    corpusHash: corpusHash(corpus),
    vectors: Object.fromEntries(corpus.map(({ id }) => [id, seededVector(id)])),
  };
  return `${JSON.stringify(index)}\n`;
}

/** `generated/retrieval-probes.json`, as its bytes: each probe question's seeded vector. */
export function seededProbes(questions: readonly string[]): string {
  const probes = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    vectors: Object.fromEntries(questions.map((question) => [question, seededVector(question)])),
  };
  return `${JSON.stringify(probes)}\n`;
}
