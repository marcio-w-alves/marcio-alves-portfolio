import { describe, expect, it } from 'vitest';
import type { EmbeddingPort } from '@/core/assistant/ports/embedding.port';
import { buildCorpus } from '@/core/knowledge/corpus';
import { EMBEDDING_DIMENSIONS, type KnowledgeIndex } from './index-spec';
import committed from './knowledge-index.json';
import { cosine, createVectorKnowledgeSearch } from './vector-knowledge-search';

const index: KnowledgeIndex = committed;
const corpus = buildCorpus();

/** Embeds every query as the given vector, standing in for the model. */
function embeddingsReturning(vector: readonly number[]): EmbeddingPort {
  return { embed: (texts) => Promise.resolve(texts.map(() => [...vector])) };
}

function vectorOf(id: string): readonly number[] {
  return index.vectors[id] ?? [];
}

/** Deterministic noise: unrelated to every passage, as an off-topic question is. */
function unrelatedVector(seed: number): number[] {
  let state = seed;
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31 - 0.5;
  });
}

describe('cosine', () => {
  it('scores identical, orthogonal and opposite vectors as 1, 0 and -1', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 2], [-1, -2])).toBeCloseTo(-1);
  });

  it('treats a zero vector as unrelated rather than dividing by zero', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe('vector knowledge search', () => {
  it('ranks the passage the query points at first', async () => {
    const search = createVectorKnowledgeSearch({
      embeddings: embeddingsReturning(vectorOf('role:shall:4')),
      index,
      corpus,
    });
    const [best] = await search.search({ query: 'internal tools', limit: 3 });
    expect(best?.id).toBe('role:shall:4');
    expect(best?.text).toContain('timesheet');
    expect(best?.source).toEqual({
      id: 'resume.shall',
      label: 'Resume · Shall And Partners experience',
    });
  });

  it('returns best matches first, no more than asked', async () => {
    const search = createVectorKnowledgeSearch({
      embeddings: embeddingsReturning(vectorOf('languages')),
      index,
      corpus,
    });
    const passages = await search.search({ query: 'languages', limit: 4 });
    expect(passages.length).toBeLessThanOrEqual(4);
    const scores = passages.map((passage) => passage.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('searches only the category asked for', async () => {
    const search = createVectorKnowledgeSearch({
      embeddings: embeddingsReturning(vectorOf('role:deel:7')),
      index,
      corpus,
    });
    const passages = await search.search({ query: 'backlog', limit: 8, category: 'skills' });
    expect(passages.every((passage) => passage.category === 'skills')).toBe(true);
  });

  it('returns nothing for a question unrelated to the record, rather than the least bad passages', async () => {
    for (const seed of [1, 2, 3]) {
      const search = createVectorKnowledgeSearch({
        embeddings: embeddingsReturning(unrelatedVector(seed)),
        index,
        corpus,
      });
      expect(await search.search({ query: 'off topic', limit: 5 })).toEqual([]);
    }
  });
});
