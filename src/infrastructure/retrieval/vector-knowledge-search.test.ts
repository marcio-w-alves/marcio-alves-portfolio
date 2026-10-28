import { describe, expect, it } from 'vitest';
import type { EmbeddingPort } from '@/core/assistant/ports/embedding.port';
import { buildCorpus, type KnowledgeChunk } from '@/core/knowledge/corpus';
import { EMBEDDING_DIMENSIONS, type KnowledgeIndex } from './index-spec';
import committed from './knowledge-index.json';
import { cosine, createVectorKnowledgeSearch, RELEVANCE_FLOOR } from './vector-knowledge-search';

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

describe('vector knowledge search — the relevance floor', () => {
  const QUERY = [1, 0];

  // Scaled up so the similarity comes out exact in floating point.
  function vectorAt(similarity: number): number[] {
    return [100 * similarity, 100 * Math.sqrt(1 - similarity ** 2)];
  }

  function chunk(id: string): KnowledgeChunk {
    return { id, category: 'experience', text: `passage ${id}`, source: 'resume.deel' };
  }

  function searchOver(similarities: Record<string, number>) {
    const ids = Object.keys(similarities);
    return createVectorKnowledgeSearch({
      embeddings: embeddingsReturning(QUERY),
      index: {
        ...index,
        vectors: Object.fromEntries(ids.map((id) => [id, vectorAt(similarities[id] ?? 0)])),
      },
      corpus: ids.map(chunk),
    });
  }

  async function idsFound(search: ReturnType<typeof searchOver>, limit = 5): Promise<string[]> {
    return (await search.search({ query: 'q', limit })).map((passage) => passage.id);
  }

  it('keeps a passage exactly at the floor and drops one just under it', async () => {
    const search = searchOver({ at: RELEVANCE_FLOOR, under: RELEVANCE_FLOOR - 0.0001 });
    expect(await idsFound(search)).toEqual(['at']);
  });

  it('applies the limit after the floor, keeping the best of what is relevant', async () => {
    const search = searchOver({ low: 0.3, high: 0.9, noise: 0.1, mid: 0.6 });
    expect(await idsFound(search, 2)).toEqual(['high', 'mid']);
  });

  it('never returns a passage the index has no vector for, as after an unrebuilt change', async () => {
    const search = createVectorKnowledgeSearch({
      embeddings: embeddingsReturning(QUERY),
      index: { ...index, vectors: { indexed: vectorAt(0.5) } },
      corpus: [chunk('indexed'), chunk('added-since')],
    });
    expect((await search.search({ query: 'q', limit: 5 })).map((p) => p.id)).toEqual(['indexed']);
  });

  it('returns nothing when the query could not be embedded', async () => {
    const search = createVectorKnowledgeSearch({
      embeddings: { embed: () => Promise.resolve([]) },
      index: { ...index, vectors: { indexed: vectorAt(0.9) } },
      corpus: [chunk('indexed')],
    });
    expect(await search.search({ query: 'q', limit: 5 })).toEqual([]);
  });
});
