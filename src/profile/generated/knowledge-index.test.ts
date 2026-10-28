import { describe, expect, it } from 'vitest';
import { buildCorpus } from '@/core/knowledge/corpus';
import { localize } from '@/core/knowledge/localize';
import {
  corpusHash,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type KnowledgeIndex,
} from '@/infrastructure/retrieval/index-spec';
import { profile } from '..';
import committed from './knowledge-index.json';

const index: KnowledgeIndex = committed;
const corpus = buildCorpus(localize(profile.knowledge, 'en'));

describe('committed knowledge index', () => {
  it('was built from the knowledge base as it is now (run `pnpm rag:build` after editing it)', () => {
    expect(index.corpusHash).toBe(corpusHash(corpus));
  });

  it('was built with the model and dimensions the query embedding uses', () => {
    expect(index.model).toBe(EMBEDDING_MODEL);
    expect(index.dimensions).toBe(EMBEDDING_DIMENSIONS);
  });

  it('holds exactly one vector of the right size for every passage', () => {
    expect(Object.keys(index.vectors).sort()).toEqual(corpus.map((chunk) => chunk.id).sort());
    for (const [id, vector] of Object.entries(index.vectors)) {
      expect(vector, id).toHaveLength(EMBEDDING_DIMENSIONS);
    }
  });
});
