import { describe, expect, it } from 'vitest';
import type {
  KnowledgeSearchPort,
  KnowledgeSearchQuery,
  Passage,
} from '../ports/knowledge-search.port';
import { buildCorpus } from '@/core/knowledge/corpus';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { createCitation } from '../citations';
import { createSearchTools, SEARCH_UNAVAILABLE } from './search-tools';

const GLOBEX = { id: 'cv.globex', label: 'CV' };

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

const knowledge = localize(fixtureKnowledge, 'en');
const corpus = buildCorpus(knowledge);
const citation = createCitation(knowledge.sourceLabels);

/** A passage of a corpus, as the vector search hands it back. */
function corpusPassage(id: string, score: number): Passage {
  const chunk = corpus.find((candidate) => candidate.id === id);
  if (!chunk) throw new Error(`${id} is not in the corpus`);
  return { id, category: chunk.category, text: chunk.text, source: citation(chunk.source), score };
}

// Ranked as the Portuguese leadership question once was: a skill list,
// education and certifications above the roles, notes alongside.
const WHOLE_RECORD = [
  corpusPassage('notes:1', 0.61),
  corpusPassage('skills:platform', 0.48),
  corpusPassage('notes:2', 0.47),
  corpusPassage('role:acme:0', 0.41),
  corpusPassage('education', 0.33),
  corpusPassage('profile', 0.31),
  corpusPassage('certifications', 0.29),
];
// The experience-only search fills its limit on any real-sized record.
const EXPERIENCE = [
  corpusPassage('role:acme:0', 0.41),
  corpusPassage('role:acme', 0.39),
  corpusPassage('role:globex', 0.36),
  corpusPassage('role:globex:0', 0.34),
  corpusPassage('role:initech', 0.33),
];

function rankedRecord() {
  const queries: KnowledgeSearchQuery[] = [];
  const port: KnowledgeSearchPort = {
    search: (query) => {
      queries.push(query);
      return Promise.resolve(query.category === 'experience' ? EXPERIENCE : WHOLE_RECORD);
    },
  };
  return { port, queries };
}

function passageIds(data: unknown): string[] {
  const shown = (data as { passages: { text: string }[] }).passages;
  return shown.map(
    ({ text }) => [...WHOLE_RECORD, ...EXPERIENCE].find((item) => item.text === text)?.id ?? text,
  );
}

describe('searchKnowledge — questions about leading people', () => {
  it.each([
    'Has he led teams?',
    'Ele já liderou equipes?',
    'Did he mentor engineers?',
    'Has he managed a team of developers?',
    'Ele já foi gestor de alguém?',
    'Ele gerenciou pessoas?',
    '¿Ha sido líder de un equipo?',
    '¿Gestionó personas?',
    'Did he supervise anyone?',
  ])('puts three role passages first for "%s"', async (question) => {
    const { port, queries } = rankedRecord();

    const result = await run(port, { query: question });

    expect(queries).toContainEqual({ query: question, limit: 5, category: 'experience' });
    expect(passageIds(result.data).slice(0, 3)).toEqual([
      'role:acme:0',
      'role:acme',
      'role:globex',
    ]);
  });

  it('keeps every note and displaces only the weakest résumé passages', async () => {
    const { port } = rankedRecord();

    const result = await run(port, { query: 'Ele já liderou equipes?' });

    expect(passageIds(result.data)).toEqual([
      'role:acme:0',
      'role:acme',
      'role:globex',
      'notes:1',
      'skills:platform',
      'notes:2',
      'education',
    ]);
  });

  it.each([
    'What is his lead time to production?',
    'How does he manage state in React?',
    'Como é o gerenciamento de estado no frontend?',
    'Ele usa gestão de estado no frontend?',
    'Does he like working in remote teams?',
    'Ele trabalha bem em equipe?',
  ])('keeps the ranking as it is for "%s"', async (question) => {
    const { port, queries } = rankedRecord();

    const result = await run(port, { query: question });

    expect(queries).toEqual([{ query: question, limit: 5 }]);
    expect(passageIds(result.data)).toEqual(WHOLE_RECORD.map(({ id }) => id));
  });

  it('tells which passages back each source, so an answer cites only what it used', async () => {
    const passages = [corpusPassage('role:acme:0', 0.4), corpusPassage('role:acme', 0.3)];
    const { port } = searchReturning([...passages, corpusPassage('education', 0.2)]);

    const result = await run(port, { query: 'Acme' });

    expect(result.evidence).toEqual({
      'cv.acme': `${passages[0]?.text ?? ''}\n${passages[1]?.text ?? ''}`,
      'cv.education': corpusPassage('education', 0).text,
    });
  });
});

describe('searchKnowledge', () => {
  it('returns matching passages with their relevance, citing each source once', async () => {
    const passage = (id: string, score: number): Passage => ({
      id,
      category: 'experience',
      text: `passage ${id}`,
      source: GLOBEX,
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
    expect(result.sources).toEqual([GLOBEX]);
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
    await run(port, { query: 'accessibility' });
    expect(queries).toEqual([{ query: 'accessibility', limit: 5 }]);
  });

  it('refuses an empty or oversized query', async () => {
    const [tool] = createSearchTools(searchReturning([]).port, rethrow);
    expect((await tool?.run({ query: ' ' }))?.ok).toBe(false);
    expect((await tool?.run({ query: 'x'.repeat(301) }))?.ok).toBe(false);
  });

  it('searches for the query without the spaces around it', async () => {
    const { port, queries } = searchReturning([]);
    await run(port, { query: '  accessibility \n' });
    expect(queries.map((query) => query.query)).toEqual(['accessibility']);
  });

  it('accepts a query at either length limit, in any script', async () => {
    const { port, queries } = searchReturning([]);
    await run(port, { query: 'ux' });
    await run(port, { query: 'é'.repeat(300) });
    await run(port, { query: 'acessibilidade na Acme 🚀' });
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
