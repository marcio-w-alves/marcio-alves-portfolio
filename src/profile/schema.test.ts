import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { fixtureAnswers, fixtureBrand, fixtureKnowledge } from '@/testing/fixture-profile';
import { validateProfile, type Identity, type Profile, type SiteEntry } from './schema';

const identity: Identity = {
  name: 'Ada Rivera',
  firstName: 'Ada',
  lastName: 'Rivera',
  initials: 'AR',
  contact: {
    email: 'ada@rivera.example',
    linkedin: 'https://www.linkedin.com/in/ada-rivera-example',
    github: 'https://github.com/ada-rivera-example',
  },
  siteHost: 'ada.example',
  userAgentProduct: 'AdaRiveraPortfolio',
  nonIdentifyingTerms: [],
};

const pipewrightEntry: SiteEntry = {
  subject: { kind: 'project', id: 'pipewright' },
  urls: ['https://pipewright.example/'],
  termsNote: "Ada's own product.",
};
const acmeEntry: SiteEntry = {
  subject: { kind: 'company', id: 'acme' },
  urls: ['https://www.acme.example/about'],
  termsNote: 'Company page; robots.txt allows it.',
};

const valid: Profile = {
  identity,
  locales: ['en'],
  knowledge: fixtureKnowledge,
  siteAllowList: [pipewrightEntry, acmeEntry],
  brand: fixtureBrand,
  copy: { en: { answers: fixtureAnswers } },
  evaluation: [],
};

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
      { contact: { ...identity.contact, email: 'ada-at-example' } },
      ['identity', 'contact', 'email'],
    ],
    [
      'a LinkedIn link over http',
      { contact: { ...identity.contact, linkedin: 'http://www.linkedin.com/in/ada' } },
      ['identity', 'contact', 'linkedin'],
    ],
    [
      'a GitHub link that is not a URL',
      { contact: { ...identity.contact, github: 'ada-rivera-example' } },
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
    expect(issuePaths({ ...valid, identity: { ...identity, ...change } })).toContainEqual(path);
  });

  it('rejects a profile published in no language', () => {
    expect(issuePaths({ ...valid, locales: [] })).toContainEqual(['locales']);
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

  it('reports every problem at once, wherever it is', () => {
    const paths = issuePaths({
      ...valid,
      identity: { ...identity, name: '' },
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
