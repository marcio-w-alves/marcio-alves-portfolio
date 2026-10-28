import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import type { KnowledgeSource, RoleSource } from './schema';
import { validateKnowledge } from './validate';

const [acme, globex, initech] = fixtureKnowledge.experience as [RoleSource, RoleSource, RoleSource];

function withRoles(...experience: RoleSource[]): KnowledgeSource {
  return { ...fixtureKnowledge, experience };
}

function issuesOf(source: KnowledgeSource) {
  try {
    validateKnowledge(source);
  } catch (error) {
    if (error instanceof ZodError) return error.issues;
    throw error;
  }
  return [];
}

describe('validating a record', () => {
  it('accepts a complete record and hands it back unchanged', () => {
    expect(validateKnowledge(fixtureKnowledge)).toBe(fixtureKnowledge);
  });

  it.each<[string, KnowledgeSource, (string | number)[]]>([
    [
      'a duplicate id',
      withRoles(acme, { ...globex, id: 'acme' }, initech),
      ['experience', 1, 'id'],
    ],
    [
      'a metric no record holds',
      withRoles({ ...acme, metrics: ['acme-unknown'] }, globex, initech),
      ['experience', 0, 'metrics', 0],
    ],
    [
      'a metric credited to another company',
      withRoles(acme, { ...globex, metrics: ['acme-build-time'] }, initech),
      ['metrics', 'acme-build-time', 'context'],
    ],
    [
      'a role that ends before it starts',
      withRoles(acme, { ...globex, end: 2010 }, initech),
      ['experience', 1, 'end'],
    ],
    [
      'two roles without an end',
      withRoles(acme, { ...globex, end: null, current: true }, initech),
      ['experience', 1, 'end'],
    ],
    ['roles out of order', withRoles(globex, acme, initech), ['experience', 1, 'start']],
    [
      'a current role that has ended',
      withRoles({ ...acme, current: false }, globex, initech),
      ['experience', 0, 'current'],
    ],
    [
      'a source nobody labels',
      withRoles({ ...acme, source: 'cv.nowhere' }, globex, initech),
      ['experience', 0, 'source'],
    ],
    [
      'a link that is not https',
      {
        ...fixtureKnowledge,
        contact: { ...fixtureKnowledge.contact, github: 'http://github.com/ada-rivera-example' },
      },
      ['contact', 'github'],
    ],
    [
      'a text left empty',
      withRoles({ ...acme, summary: { en: '  ' } }, globex, initech),
      ['experience', 0, 'summary', 'en'],
    ],
    [
      'a project with no engineering note',
      {
        ...fixtureKnowledge,
        practice: { ...fixtureKnowledge.practice, productDepth: { loomstack: { en: 'Notes.' } } },
      },
      ['practice', 'productDepth', 'pipewright'],
    ],
  ])('rejects %s, naming where it is', (_case, source, path) => {
    expect(issuesOf(source).map((issue) => issue.path)).toContainEqual(path);
  });

  it('rejects a field the record does not define, so a phone number cannot slip in', () => {
    const withPhone = { ...fixtureKnowledge, phone: '+15550100000' } as KnowledgeSource;
    expect(issuesOf(withPhone)).toContainEqual(
      expect.objectContaining({ code: 'unrecognized_keys', keys: ['phone'] }),
    );
  });
});
