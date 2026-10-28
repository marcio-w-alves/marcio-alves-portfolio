import { describe, expect, it } from 'vitest';
import { buildCorpus } from '@/core/knowledge/corpus';
import {
  corpusHash,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type KnowledgeIndex,
} from '@/infrastructure/retrieval/index-spec';
import { cosine } from '@/infrastructure/retrieval/vector-knowledge-search';
import { profile } from '..';
import { createCitation } from '@/core/assistant/citations';
import { localize } from '@/core/knowledge/localize';
import { createCircuitBreaker } from '@/infrastructure/resilience/circuit-breaker';
import { createVectorKnowledgeSearch } from '@/infrastructure/retrieval/vector-knowledge-search';
import { RETRIEVAL_PROBES } from '../retrieval-probes';
import committed from './knowledge-index.json';
import probes from './retrieval-probes.json';

const index: KnowledgeIndex = committed;
const corpus = buildCorpus(profile.knowledge);

function vectorOf(id: string): readonly number[] {
  const vector = index.vectors[id];
  if (!vector) throw new Error(`The index has no vector for ${id}.`);
  return vector;
}

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

  it('holds the record in English and in Portuguese, and the notes and sites once', () => {
    const ids = Object.keys(index.vectors);
    const english = ids.filter((id) => id.startsWith('en/'));
    expect(english.length).toBeGreaterThan(0);
    expect(ids.filter((id) => id.startsWith('pt-BR/'))).toHaveLength(english.length);
    expect(ids).toContain('notes:1:1');
  });

  // A Portuguese vector far from its own English one is a stale index or a
  // translation that says something else: fix the translation, not this test.
  it('places every Portuguese passage among the three closest to its own English one', () => {
    const english = corpus.filter(({ id }) => id.startsWith('en/'));
    const nearestEnglish = (vector: readonly number[]) =>
      english
        .map(({ id, baseId }) => ({ baseId, score: cosine(vector, vectorOf(id)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ baseId }) => baseId);

    const astray = corpus
      .filter(({ id }) => id.startsWith('pt-BR/'))
      .filter(({ id, baseId }) => !nearestEnglish(vectorOf(id)).includes(baseId))
      .map(({ baseId }) => baseId);

    expect(astray).toEqual([]);
  });
});

describe('a Portuguese question searched in the committed index', () => {
  const question = RETRIEVAL_PROBES.currentRoleInPortuguese;
  const current = profile.knowledge.experience.find((role) => role.current);
  if (!current) throw new Error('The record has no current role.');

  function probeVector(): readonly number[] {
    const vector = (probes.vectors as Readonly<Record<string, readonly number[]>>)[question];
    if (!vector) throw new Error(`"${question}" has no embedding: run \`pnpm rag:probes\`.`);
    return vector;
  }

  it('holds the embedding of each probe, made like the index (run `pnpm rag:probes`)', () => {
    expect(Object.keys(probes.vectors).sort()).toEqual(Object.values(RETRIEVAL_PROBES).sort());
    expect([probes.model, probes.dimensions]).toEqual([index.model, index.dimensions]);
  });

  it('finds the current role first, in its Portuguese words', async () => {
    const search = createVectorKnowledgeSearch({
      embeddings: { embed: (texts) => Promise.resolve(texts.map(() => [...probeVector()])) },
      index,
      corpus,
      citation: createCitation(localize(profile.knowledge, 'en')),
      breaker: createCircuitBreaker({ failureThreshold: 3, cooldownMs: 30_000 }),
    });

    // Among the roles: the profile and the notes also answer "where", and
    // join the results beside them; which role comes first is what is asked.
    const [best] = await search.search({ query: question, limit: 3, category: 'experience' });

    expect(best?.id).toMatch(new RegExp(`^role:${current.id}(:|$)`));
    expect(best?.text).toBe(corpus.find((chunk) => chunk.id === `pt-BR/${best?.id ?? ''}`)?.text);
  });
});
