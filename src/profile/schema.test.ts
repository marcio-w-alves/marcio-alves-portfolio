import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { KnowledgeSource } from '@/core/knowledge/schema';
import {
  fixtureAnswers,
  fixtureBrand,
  fixtureCopy,
  fixtureIdentity,
  fixtureKnowledge,
  fixtureSiteAllowList,
  fixtureSiteCopy,
  fixtureUiCopy,
} from '@/testing/fixture-profile';
import { withMetric, withRole } from '@/testing/fixture-profile/variants';
import { validateProfile, type Identity, type Profile, type SiteEntry } from './schema';

const [pipewrightEntry, acmeEntry] = fixtureSiteAllowList as [SiteEntry, SiteEntry];

const valid: Profile = {
  identity: fixtureIdentity,
  locales: ['en'],
  knowledge: fixtureKnowledge,
  siteAllowList: fixtureSiteAllowList,
  brand: fixtureBrand,
  copy: { en: { answers: fixtureAnswers, ui: fixtureUiCopy, site: fixtureSiteCopy } },
  evaluation: [],
};

/** The record as it was before any of it was translated. */
function inEnglishOnly(knowledge: KnowledgeSource): KnowledgeSource {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (value === null || typeof value !== 'object') return value;
    if ('en' in value && typeof value.en === 'string') return { en: value.en };
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, visit(field)]));
  };
  return visit(knowledge) as KnowledgeSource;
}

/** The fixture's record with the Portuguese of one highlight of its third role replaced. */
function withThirdRoleHighlight(portuguese: string | undefined): KnowledgeSource {
  return withRole(fixtureKnowledge, 'initech', {
    highlights: [
      portuguese === undefined
        ? { en: 'Audited and simplified the build scripts.' }
        : { en: 'Audited and simplified the build scripts.', 'pt-BR': portuguese },
    ],
  });
}

const bilingual: Profile = { ...valid, locales: ['en', 'pt-BR'], copy: fixtureCopy };

function issuePaths(profile: Profile): PropertyKey[][] {
  try {
    validateProfile(profile);
  } catch (error) {
    if (error instanceof ZodError) return error.issues.map((issue) => [...issue.path]);
    throw error;
  }
  return [];
}

describe('validating a profile', () => {
  it('accepts a complete profile and hands it back unchanged', () => {
    expect(validateProfile(valid)).toBe(valid);
  });

  it.each<[string, Partial<Identity>, (string | number)[]]>([
    ['a blank name', { name: ' ' }, ['identity', 'name']],
    ['a blank first name', { firstName: '' }, ['identity', 'firstName']],
    ['a blank last name', { lastName: '' }, ['identity', 'lastName']],
    ['blank initials', { initials: '' }, ['identity', 'initials']],
    [
      'an email that is not one',
      { contact: { ...fixtureIdentity.contact, email: 'ada-at-example' } },
      ['identity', 'contact', 'email'],
    ],
    [
      'a LinkedIn link over http',
      { contact: { ...fixtureIdentity.contact, linkedin: 'http://www.linkedin.com/in/ada' } },
      ['identity', 'contact', 'linkedin'],
    ],
    [
      'a GitHub link that is not a URL',
      { contact: { ...fixtureIdentity.contact, github: 'ada-rivera-example' } },
      ['identity', 'contact', 'github'],
    ],
    [
      'a domain that is not a host name',
      { siteHost: 'https://ada.example/' },
      ['identity', 'siteHost'],
    ],
    [
      'a User-Agent product with a space',
      { userAgentProduct: 'Ada Rivera' },
      ['identity', 'userAgentProduct'],
    ],
  ])('rejects %s, naming where it is', (_case, change, path) => {
    expect(issuePaths({ ...valid, identity: { ...fixtureIdentity, ...change } })).toContainEqual(
      path,
    );
  });

  it('rejects a profile published in no language', () => {
    expect(issuePaths({ ...valid, locales: [] })).toContainEqual(['locales']);
  });

  it('rejects a profile that leaves out English, the language of the unprefixed addresses', () => {
    expect(issuePaths({ ...valid, locales: ['pt-BR'] })).toContainEqual(['locales']);
  });

  it('rejects publishing Portuguese before its copy and the record are written in it', () => {
    const paths = issuePaths({
      ...valid,
      locales: ['en', 'pt-BR'],
      knowledge: inEnglishOnly(fixtureKnowledge),
    });

    expect(paths).toContainEqual(['copy', 'pt-BR']);
    expect(paths).toContainEqual(['knowledge', 'profile', 'title', 'pt-BR']);
    expect(paths).toContainEqual(['knowledge', 'experience', 0, 'summary', 'pt-BR']);
  });

  it('publishes Portuguese once the copy and every text of the record are written in it', () => {
    expect(issuePaths(bilingual)).toEqual([]);
  });

  it('names the one text a Portuguese publication still lacks', () => {
    const missing = { ...bilingual, knowledge: withThirdRoleHighlight(undefined) };

    expect(issuePaths(missing)).toEqual([['knowledge', 'experience', 2, 'highlights', 0, 'pt-BR']]);
  });

  it('rejects a translation that states a figure its English text does not', () => {
    const embellished = {
      ...bilingual,
      knowledge: withThirdRoleHighlight('Auditou e simplificou 70% dos scripts de build.'),
    };

    expect(() => validateProfile(embellished)).toThrow(/not 70/);
    expect(issuePaths(embellished)).toEqual([
      ['knowledge', 'experience', 2, 'highlights', 0, 'pt-BR'],
    ]);
  });

  it('accepts a translation that writes the same figure the way its language does', () => {
    const knowledge = withMetric(fixtureKnowledge, 'acme-build-time', {
      label: { en: 'Builds 1.5x faster', 'pt-BR': 'Builds 1,5x mais rápidos' },
    });

    expect(issuePaths({ ...bilingual, knowledge })).toEqual([]);
  });

  it('checks the translations only of a language the profile publishes', () => {
    const embellished = withThirdRoleHighlight('Auditou e simplificou 70% dos scripts de build.');

    expect(issuePaths({ ...valid, knowledge: embellished })).toEqual([]);
  });

  it('rejects a brand colour that is not #rrggbb, naming the token', () => {
    const brand = { ...fixtureBrand, colors: { ...fixtureBrand.colors, ink: '#123' as const } };
    expect(issuePaths({ ...valid, brand })).toContainEqual(['brand', 'colors', 'ink']);
  });

  it('rejects an image face whose file the renderer cannot read', () => {
    const imageFont = { ...fixtureBrand.imageFont, files: { 400: 'a.woff2', 600: 'b.woff' } };
    expect(issuePaths({ ...valid, brand: { ...fixtureBrand, imageFont } })).toContainEqual([
      'brand',
      'imageFont',
      'files',
      '400',
    ]);
  });

  it('rejects a site passage read from a page the allow-list does not name', () => {
    expect(issuePaths({ ...valid, siteAllowList: [acmeEntry] })).toEqual([
      ['knowledge', 'productSites', 0, 'url'],
    ]);
  });

  it("rejects a site passage filed under another subject than its page's", () => {
    const swapped = { ...pipewrightEntry, subject: { kind: 'project' as const, id: 'loomstack' } };
    expect(issuePaths({ ...valid, siteAllowList: [swapped, acmeEntry] })).toEqual([
      ['knowledge', 'productSites', 0, 'url'],
    ]);
  });

  it('rejects an allow-listed page that is not https', () => {
    const entry = { ...pipewrightEntry, urls: ['http://pipewright.example/'] };
    expect(issuePaths({ ...valid, siteAllowList: [entry] })).toContainEqual([
      'siteAllowList',
      0,
      'urls',
      0,
    ]);
  });

  it('rejects an exclusion pattern that is not a valid regular expression', () => {
    const entry = { ...pipewrightEntry, excludes: ['Exact paragraph.', '/^(unclosed/'] };
    expect(issuePaths({ ...valid, siteAllowList: [entry, acmeEntry] })).toEqual([
      ['siteAllowList', 0, 'excludes', 1],
    ]);
  });

  it('reports every problem at once, wherever it is', () => {
    const paths = issuePaths({
      ...valid,
      identity: { ...fixtureIdentity, name: '' },
      knowledge: { ...fixtureKnowledge, contact: { ...fixtureKnowledge.contact, email: 'nope' } },
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        ['identity', 'name'],
        ['knowledge', 'contact', 'email'],
      ]),
    );
  });
});
