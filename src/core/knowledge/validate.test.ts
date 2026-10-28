import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import type { KnowledgeSource, ProjectSource, RoleSource, SitePassage } from './schema';
import { validateKnowledge } from './validate';

const [acme, globex, initech] = fixtureKnowledge.experience as [RoleSource, RoleSource, RoleSource];
const [pipewright, loomstack] = fixtureKnowledge.projects as [ProjectSource, ProjectSource];
const [pipewrightPage] = fixtureKnowledge.productSites as [SitePassage];

function withProjects(...projects: ProjectSource[]): KnowledgeSource {
  return { ...fixtureKnowledge, projects };
}

function withSitePassages(...productSites: SitePassage[]): KnowledgeSource {
  return { ...fixtureKnowledge, productSites };
}

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
    [
      'a skill group citing a source nobody labels',
      {
        ...fixtureKnowledge,
        skills: fixtureKnowledge.skills.map((group) => ({ ...group, source: 'cv.nowhere' })),
      },
      ['skills', 0, 'source'],
    ],
    [
      'a principle citing a source nobody labels',
      {
        ...fixtureKnowledge,
        principles: fixtureKnowledge.principles.map((item) => ({ ...item, source: 'cv.nowhere' })),
      },
      ['principles', 0, 'source'],
    ],
    [
      'no technology the assistant may look up, which leaves its lookup with nothing to accept',
      { ...fixtureKnowledge, references: { technologies: {} } },
      ['references', 'technologies'],
    ],
    [
      'notes citing a source nobody labels',
      { ...fixtureKnowledge, notes: { ...fixtureKnowledge.notes, source: 'cv.nowhere' } },
      ['notes', 'source'],
    ],
    [
      'certifications split across sources, though they are cited as one section',
      {
        ...fixtureKnowledge,
        certifications: [
          ...fixtureKnowledge.certifications,
          { name: 'Another course', issuer: 'Guild', source: 'cv.skills' },
        ],
      },
      ['certifications', fixtureKnowledge.certifications.length, 'source'],
    ],
    [
      'languages split across sources, though they are cited as one section',
      {
        ...fixtureKnowledge,
        languages: fixtureKnowledge.languages.map((language, index) =>
          index === 1 ? { ...language, source: 'cv.skills' } : language,
        ),
      },
      ['languages', 1, 'source'],
    ],
    [
      'technologies listed with no source that states them',
      withProjects({ ...pipewright, technologies: ['Go'] }, loomstack),
      ['projects', 0, 'technologiesSource'],
    ],
    [
      'technologies credited to a source the record does not hold',
      withProjects(
        { ...pipewright, technologies: ['Go'], technologiesSource: 'cv.nowhere' },
        loomstack,
      ),
      ['projects', 0, 'technologiesSource'],
    ],
    [
      "technologies credited to another project's site",
      withProjects(pipewright, {
        ...loomstack,
        technologies: ['Go'],
        technologiesSource: pipewrightPage.url,
      }),
      ['projects', 1, 'technologiesSource'],
    ],
    [
      'two site passages with one id',
      withSitePassages(pipewrightPage, { ...pipewrightPage, url: 'https://pipewright.example/b' }),
      ['productSites', 1, 'id'],
    ],
    [
      'a site passage about a project the record does not hold',
      withSitePassages({ ...pipewrightPage, subject: { kind: 'project', id: 'acme' } }),
      ['productSites', 0, 'subject', 'id'],
    ],
    [
      'a site passage with no fetch date',
      withSitePassages({ ...pipewrightPage, fetchedAt: 'last week' }),
      ['productSites', 0, 'fetchedAt'],
    ],
    [
      'a site passage read over http',
      withSitePassages({ ...pipewrightPage, url: 'http://pipewright.example/' }),
      ['productSites', 0, 'url'],
    ],
  ])('rejects %s, naming where it is', (_case, source, path) => {
    expect(issuesOf(source).map((issue) => issue.path)).toContainEqual(path);
  });

  it.each<[string, ProjectSource]>([
    [
      'a source of the record',
      { ...pipewright, technologies: ['Go'], technologiesSource: 'projects' },
    ],
    [
      'a page of its own site',
      { ...pipewright, technologies: ['Go'], technologiesSource: pipewrightPage.url },
    ],
  ])('accepts technologies stated by %s', (_case, project) => {
    expect(issuesOf(withProjects(project, loomstack))).toEqual([]);
  });

  it('rejects a field the record does not define, so a phone number cannot slip in', () => {
    const withPhone = { ...fixtureKnowledge, phone: '+15550100000' } as KnowledgeSource;
    expect(issuesOf(withPhone)).toContainEqual(
      expect.objectContaining({ code: 'unrecognized_keys', keys: ['phone'] }),
    );
  });
});
