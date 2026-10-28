import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCitation } from '@/core/assistant/citations';
import type { EmbeddingPort } from '@/core/assistant/ports/embedding.port';
import { buildCorpus, type KnowledgeChunk } from '@/core/knowledge/corpus';
import { localize } from '@/core/knowledge/localize';
import { profile } from '@/profile';
import committed from '@/profile/generated/knowledge-index.json';
import { createOpenAIClient } from '../openai/openai-client';
import { createOpenAIEmbeddings, EmbeddingsTimeoutError } from '../openai/openai-embeddings';
import { CircuitOpenError, createCircuitBreaker } from '../resilience/circuit-breaker';
import { EMBEDDING_DIMENSIONS, type KnowledgeIndex } from './index-spec';
import {
  cosine,
  createVectorKnowledgeSearch,
  NOTES_SHARE,
  RELEVANCE_FLOOR,
} from './vector-knowledge-search';

const knowledge = localize(profile.knowledge, 'en');
const index: KnowledgeIndex = committed;
const corpus = buildCorpus(knowledge);
const citation = createCitation(knowledge.sourceLabels);

function newBreaker(now: () => number = Date.now) {
  return createCircuitBreaker({ failureThreshold: 3, cooldownMs: 30_000, now });
}

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
      citation,
      breaker: newBreaker(),
      embeddings: embeddingsReturning(vectorOf('role:shall:4')),
      index,
      corpus,
    });
    const [best] = await search.search({ query: 'internal tools', limit: 3 });
    expect(best?.id).toBe('role:shall:4');
    expect(best?.text).toContain('timesheet');
    expect(best?.source).toEqual({
      id: 'resume.shall',
      label: 'Resume',
    });
  });

  it('returns best matches first, no more than asked from the résumé plus a few notes', async () => {
    const search = createVectorKnowledgeSearch({
      citation,
      breaker: newBreaker(),
      embeddings: embeddingsReturning(vectorOf('languages')),
      index,
      corpus,
    });
    const passages = await search.search({ query: 'languages', limit: 4 });
    const notes = passages.filter((passage) => passage.category === 'notes');
    expect(passages.length - notes.length).toBeLessThanOrEqual(4);
    expect(notes.length).toBeLessThanOrEqual(NOTES_SHARE);
    const scores = passages.map((passage) => passage.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('searches only the category asked for', async () => {
    const search = createVectorKnowledgeSearch({
      citation,
      breaker: newBreaker(),
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
        citation,
        breaker: newBreaker(),
        embeddings: embeddingsReturning(unrelatedVector(seed)),
        index,
        corpus,
      });
      expect(await search.search({ query: 'off topic', limit: 5 })).toEqual([]);
    }
  });
});

describe('vector knowledge search — résumé and notes together', () => {
  it('keeps the résumé passages a long Portuguese note would otherwise outscore', async () => {
    const query = [1, 0];
    const at = (similarity: number) => [100 * similarity, 100 * Math.sqrt(1 - similarity ** 2)];
    const ids = { 'note-a': 0.9, 'note-b': 0.85, 'note-c': 0.8, 'note-d': 0.75, resume: 0.4 };
    const search = createVectorKnowledgeSearch({
      citation,
      breaker: newBreaker(),
      embeddings: embeddingsReturning(query),
      index: {
        ...index,
        vectors: Object.fromEntries(Object.entries(ids).map(([id, s]) => [id, at(s)])),
      },
      corpus: Object.keys(ids).map((id): KnowledgeChunk =>
        id === 'resume'
          ? { id, category: 'experience', text: id, source: 'resume.toptal' }
          : { id, category: 'notes', text: id, source: 'notes' },
      ),
    });
    expect((await search.search({ query: 'acessibilidade', limit: 1 })).map((p) => p.id)).toEqual([
      'note-a',
      'resume',
    ]);
    expect((await search.search({ query: 'acessibilidade', limit: 5 })).map((p) => p.id)).toEqual([
      'note-a',
      'note-b',
      'note-c',
      'resume',
    ]);
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
      citation,
      breaker: newBreaker(),
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
      citation,
      breaker: newBreaker(),
      embeddings: embeddingsReturning(QUERY),
      index: { ...index, vectors: { indexed: vectorAt(0.5) } },
      corpus: [chunk('indexed'), chunk('added-since')],
    });
    expect((await search.search({ query: 'q', limit: 5 })).map((p) => p.id)).toEqual(['indexed']);
  });

  it('returns nothing when the query could not be embedded', async () => {
    const search = createVectorKnowledgeSearch({
      citation,
      breaker: newBreaker(),
      embeddings: { embed: () => Promise.resolve([]) },
      index: { ...index, vectors: { indexed: vectorAt(0.9) } },
      corpus: [chunk('indexed')],
    });
    expect(await search.search({ query: 'q', limit: 5 })).toEqual([]);
  });
});

describe('vector knowledge search — when embeddings fail', () => {
  const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
  const server = setupServer();
  let outbound = 0;
  // A fresh connection pool per test: MSW's emulated socket for a request
  // that timed out can still be tearing down when the next test connects.
  const sharedConnections = getGlobalDispatcher();
  let connections: Agent;

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
    server.events.on('request:start', () => {
      outbound += 1;
    });
  });
  beforeEach(() => {
    connections = new Agent();
    setGlobalDispatcher(connections);
  });
  afterEach(async () => {
    server.resetHandlers();
    outbound = 0;
    await connections.destroy();
  });
  afterAll(() => {
    setGlobalDispatcher(sharedConnections);
    server.close();
  });

  function embeddingsAnswer(status: () => 200 | 500) {
    server.use(
      http.post(EMBEDDINGS_URL, () =>
        status() === 500
          ? HttpResponse.json({ error: { message: 'stubbed outage' } }, { status: 500 })
          : HttpResponse.json({
              object: 'list',
              model: 'text-embedding-3-small',
              data: [{ object: 'embedding', index: 0, embedding: vectorOf('role:toptal') }],
              usage: { prompt_tokens: 1, total_tokens: 1 },
            }),
      ),
    );
  }

  function searchThroughOpenAI({ timeoutMs }: { timeoutMs?: number } = {}) {
    let clock = 0;
    const breaker = newBreaker(() => clock);
    const search = createVectorKnowledgeSearch({
      citation,
      embeddings: createOpenAIEmbeddings({
        client: createOpenAIClient('test-key'),
        model: 'text-embedding-3-small',
        dimensions: EMBEDDING_DIMENSIONS,
        ...(timeoutMs ? { timeoutMs } : {}),
      }),
      index,
      corpus,
      breaker,
    });
    return {
      search: (signal?: AbortSignal) =>
        search.search({ query: 'talent marketplace', limit: 3, ...(signal ? { signal } : {}) }),
      breaker,
      advance: (ms: number) => {
        clock += ms;
      },
    };
  }

  it('stops calling embeddings after repeated failures, and probes again after the cooldown', async () => {
    let status: 200 | 500 = 500;
    embeddingsAnswer(() => status);
    const { search, breaker, advance } = searchThroughOpenAI();
    for (let i = 0; i < 3; i += 1) await expect(search()).rejects.toThrow('stubbed outage');

    await expect(search()).rejects.toBeInstanceOf(CircuitOpenError);
    expect(outbound).toBe(3);

    advance(30_000);
    status = 200;
    const [best] = await search();
    expect(best?.id).toBe('role:toptal');
    expect(outbound).toBe(4);
    expect(breaker.state()).toBe('closed');
  });

  it('opens the retrieval circuit after embeddings time out repeatedly', async () => {
    server.use(
      http.post(EMBEDDINGS_URL, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    const { search } = searchThroughOpenAI({ timeoutMs: 50 });
    for (let i = 0; i < 3; i += 1) {
      await expect(search()).rejects.toBeInstanceOf(EmbeddingsTimeoutError);
    }

    await expect(search()).rejects.toBeInstanceOf(CircuitOpenError);
    expect(outbound).toBe(3);
  });

  it('does not count searches the visitor cancelled as embeddings failing', async () => {
    embeddingsAnswer(() => 200);
    const { search, breaker } = searchThroughOpenAI();
    for (let i = 0; i < 3; i += 1) {
      await expect(search(AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
    }

    expect(breaker.state()).toBe('closed');
    expect((await search()).length).toBeGreaterThan(0);
  });
});
