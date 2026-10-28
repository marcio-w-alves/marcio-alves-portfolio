import { describe, expect, it } from 'vitest';
import type {
  KnowledgeSearchPort,
  KnowledgeSearchQuery,
  Passage,
} from '../ports/knowledge-search.port';
import { createSearchTools, SEARCH_UNAVAILABLE } from './search-tools';

const SHALL = { id: 'resume.shall', label: 'Resume' };

function searchReturning(passages: Passage[]): {
  port: KnowledgeSearchPort;
  queries: KnowledgeSearchQuery[];
} {
  const queries: KnowledgeSearchQuery[] = [];
  return {
    queries,
    port: {
      search: (query) => {
        queries.push(query);
        return Promise.resolve(passages);
      },
    },
  };
}

function rethrow(error: unknown): never {
  throw error;
}

async function run(port: KnowledgeSearchPort, args: unknown) {
  const [tool] = createSearchTools(port, rethrow);
  if (!tool) throw new Error('searchKnowledge is missing');
  const outcome = await tool.run(args);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

describe('searchKnowledge', () => {
  it('returns matching passages with their relevance, citing each source once', async () => {
    const passage = (id: string, score: number): Passage => ({
      id,
      category: 'experience',
      text: `passage ${id}`,
      source: SHALL,
      score,
    });
    const { port } = searchReturning([passage('a', 0.4172), passage('b', 0.33)]);
    const result = await run(port, { query: 'internal tools' });
    expect(result.data).toEqual({
      passages: [
        { text: 'passage a', category: 'experience', relevance: 0.42 },
        { text: 'passage b', category: 'experience', relevance: 0.33 },
      ],
    });
    expect(result.sources).toEqual([SHALL]);
  });

  it('tells the model not to fall back on general knowledge when nothing matches', async () => {
    const { port } = searchReturning([]);
    const result = await run(port, { query: 'weather in Paris' });
    expect(result.data).toEqual({
      passages: [],
      note: 'Nothing in the documented record matches. Do not answer from general knowledge.',
    });
    expect(result.sources).toEqual([]);
  });

  it('searches his whole record for the five best passages', async () => {
    const { port, queries } = searchReturning([]);
    await run(port, { query: 'leadership' });
    expect(queries).toEqual([{ query: 'leadership', limit: 5 }]);
  });

  it('refuses an empty or oversized query', async () => {
    const [tool] = createSearchTools(searchReturning([]).port, rethrow);
    expect((await tool?.run({ query: ' ' }))?.ok).toBe(false);
    expect((await tool?.run({ query: 'x'.repeat(301) }))?.ok).toBe(false);
  });

  it('searches for the query without the spaces around it', async () => {
    const { port, queries } = searchReturning([]);
    await run(port, { query: '  leadership \n' });
    expect(queries.map((query) => query.query)).toEqual(['leadership']);
  });

  it('accepts a query at either length limit, in any script', async () => {
    const { port, queries } = searchReturning([]);
    await run(port, { query: 'ux' });
    await run(port, { query: 'é'.repeat(300) });
    await run(port, { query: 'liderança de equipes 🚀' });
    expect(queries).toHaveLength(3);
  });

  it.each([
    ['a one-letter query', { query: 'a' }],
    ['a category filter, which it no longer takes', { query: 'pets', category: 'profile' }],
    ['a limit, which it no longer takes', { query: 'leadership', limit: 1 }],
    ['a query that is not text', { query: ['leadership'] }],
  ])('refuses %s without searching', async (_label, args) => {
    const { port, queries } = searchReturning([]);
    const [tool] = createSearchTools(port, rethrow);
    expect((await tool?.run(args))?.ok).toBe(false);
    expect(queries).toEqual([]);
  });

  it('tells the model search is unavailable when retrieval fails, reporting why', async () => {
    const outage = new Error('embeddings circuit open');
    const reported: unknown[] = [];
    const [tool] = createSearchTools({ search: () => Promise.reject(outage) }, (error) =>
      reported.push(error),
    );

    const outcome = await tool?.run({ query: 'leadership' });

    expect(outcome).toEqual({
      ok: true,
      result: { data: { passages: [], note: SEARCH_UNAVAILABLE }, sources: [] },
    });
    expect(reported).toEqual([{ tool: 'searchKnowledge', error: outage }]);
    expect(SEARCH_UNAVAILABLE).toContain('Do not answer from general knowledge.');
  });

  it('stops with the visitor instead of answering when the search was cancelled', async () => {
    const request = new AbortController();
    request.abort();
    const [tool] = createSearchTools(
      { search: () => Promise.reject(request.signal.reason as Error) },
      () => {
        throw new Error('a cancellation is not a failure to report');
      },
    );

    await expect(tool?.run({ query: 'leadership' }, request.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('searches on behalf of the visitor request, so it stops when they leave', async () => {
    const { port, queries } = searchReturning([]);
    const [tool] = createSearchTools(port, rethrow);
    const request = new AbortController();
    await tool?.run({ query: 'leadership' }, request.signal);
    expect(queries[0]?.signal).toBe(request.signal);
  });
});
