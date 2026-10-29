import { z } from 'zod';
import { buildCorpus } from '../../../src/core/knowledge/corpus';
import {
  corpusHash,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from '../../../src/infrastructure/retrieval/index-spec';
import type { ProfileData } from '../../../src/profile/schema';
import type { DecodedBundle } from '../bundle/decode';
import { DOCUMENTS } from '../bundle/layout';
import type { BundleProblem } from '../bundle/problems';

/**
 * The retrieval index and the probes' embeddings were built from this record
 * and these probes, with the model and dimensions the query embedding uses.
 * A stale index would answer from a record that no longer exists.
 */

const REBUILD = 'rebuild the index and the probes (pnpm rag:build)';

const vectorsSchema = z.record(z.string(), z.array(z.number()));
const indexSchema = z.object({
  model: z.string(),
  dimensions: z.number(),
  corpusHash: z.string(),
  vectors: vectorsSchema,
});
const probesSchema = z.object({
  model: z.string(),
  dimensions: z.number(),
  vectors: vectorsSchema,
});

const problem = (document: string, text: string): BundleProblem => ({
  document,
  problem: text,
  remedy: REBUILD,
});

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  return left.size === new Set(b).size && b.every((item) => left.has(item));
}

function specProblems(
  document: string,
  { model, dimensions }: { model: string; dimensions: number },
) {
  return [
    ...(model === EMBEDDING_MODEL
      ? []
      : [problem(document, `was built with ${model}, not ${EMBEDDING_MODEL}`)]),
    ...(dimensions === EMBEDDING_DIMENSIONS
      ? []
      : [
          problem(
            document,
            `has ${String(dimensions)} dimensions, not ${String(EMBEDDING_DIMENSIONS)}`,
          ),
        ]),
  ];
}

function vectorSizeProblems(
  document: string,
  vectors: Readonly<Record<string, readonly number[]>>,
) {
  const wrong = Object.entries(vectors).filter(
    ([, vector]) => vector.length !== EMBEDDING_DIMENSIONS,
  );
  return wrong.length === 0
    ? []
    : [
        problem(
          document,
          `has ${String(wrong.length)} vectors that are not ${String(EMBEDDING_DIMENSIONS)} long`,
        ),
      ];
}

function indexProblems(data: ProfileData, raw: unknown): BundleProblem[] {
  const index = indexSchema.safeParse(raw);
  if (!index.success) return [problem(DOCUMENTS.index, 'is not a retrieval index')];
  const corpus = buildCorpus(data.knowledge);
  const { vectors } = index.data;
  return [
    ...(index.data.corpusHash === corpusHash(corpus)
      ? []
      : [problem(DOCUMENTS.index, 'was built from another version of the record')]),
    ...specProblems(DOCUMENTS.index, index.data),
    ...(sameSet(
      Object.keys(vectors),
      corpus.map(({ id }) => id),
    )
      ? []
      : [problem(DOCUMENTS.index, 'does not hold exactly one vector per passage of the record')]),
    ...vectorSizeProblems(DOCUMENTS.index, vectors),
  ];
}

function probeProblems(data: ProfileData, raw: unknown): BundleProblem[] {
  const probes = probesSchema.safeParse(raw);
  if (!probes.success)
    return [problem(DOCUMENTS.probeEmbeddings, 'is not a set of probe embeddings')];
  const { vectors } = probes.data;
  return [
    ...specProblems(DOCUMENTS.probeEmbeddings, probes.data),
    ...(sameSet(Object.keys(vectors), Object.values(data.retrievalProbes))
      ? []
      : [
          problem(
            DOCUMENTS.probeEmbeddings,
            `does not hold exactly one vector per question of ${DOCUMENTS.probes}`,
          ),
        ]),
    ...vectorSizeProblems(DOCUMENTS.probeEmbeddings, vectors),
  ];
}

export function checkRetrievalIndex(data: ProfileData, decoded: DecodedBundle): BundleProblem[] {
  return [...indexProblems(data, decoded.index), ...probeProblems(data, decoded.probeEmbeddings)];
}
