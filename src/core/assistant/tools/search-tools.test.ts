import { describe, expect, it } from 'vitest';
import type {
  KnowledgeSearchPort,
  KnowledgeSearchQuery,
  Passage,
} from '../ports/knowledge-search.port';
import { createSearchTools } from './search-tools';

const SHALL = { id: 'resume.shall', label: 'Resume · Shall And Partners experience' };

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

async function run(port: KnowledgeSearchPort, args: unknown) {
  const [tool] = createSearchTools(port);
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

  it('passes the category and limit through, defaulting to five results', async () => {
    const { port, queries } = searchReturning([]);
    await run(port, { query: 'leadership' });
    await run(port, { query: 'leadership', category: 'skills', limit: 2 });
    expect(queries).toEqual([
      { query: 'leadership', limit: 5 },
      { query: 'leadership', limit: 2, category: 'skills' },
    ]);
  });

  it('refuses an empty or oversized query', async () => {
    const [tool] = createSearchTools(searchReturning([]).port);
    expect((await tool?.run({ query: ' ' }))?.ok).toBe(false);
    expect((await tool?.run({ query: 'x'.repeat(301) }))?.ok).toBe(false);
  });
});
