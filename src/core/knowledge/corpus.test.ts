import { describe, expect, it } from 'vitest';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { buildCorpus, CHUNK_CATEGORIES } from './corpus';
import { localize } from './localize';
import { siteSourceId } from './product-sites';

const knowledge = localize(fixtureKnowledge, 'en');
const corpus = buildCorpus(knowledge);

describe('knowledge corpus', () => {
  it('gives every passage a unique, stable id', () => {
    const ids = corpus.map((chunk) => chunk.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(buildCorpus(knowledge).map((chunk) => chunk.id)).toEqual(ids);
  });

  it('files every passage under one of the declared categories, and uses all of them', () => {
    expect(new Set(corpus.map((chunk) => chunk.category))).toEqual(new Set(CHUNK_CATEGORIES));
  });

  it('turns every resume statement into its own passage, naming the company', () => {
    for (const role of knowledge.experience) {
      for (const statement of role.highlights) {
        const passage = corpus.find((chunk) => chunk.text.endsWith(statement));
        expect(passage, statement).toBeDefined();
        expect(passage?.text).toContain(role.company);
        expect(passage?.source).toBe(role.source);
      }
    }
  });

  it('turns every note of the knowledge-base document into its own passage', () => {
    const notes = corpus.filter((chunk) => chunk.category === 'notes');
    expect(notes.map(({ id, text }) => [id, text])).toEqual(
      knowledge.notes.passages.map(({ id, text }) => [`notes:${id}`, text]),
    );
  });

  it('leaves contact details out, so they can only come through the contact action', () => {
    const everything = corpus.map((chunk) => chunk.text).join('\n');
    expect(everything).not.toContain(knowledge.contact.email);
    expect(everything).not.toContain(knowledge.contact.linkedin);
  });

  it('tells a live product from a concept in the passage itself, naming whose it is', () => {
    const live = corpus.find((chunk) => chunk.id === 'project:pipewright')?.text;
    const concept = corpus.find((chunk) => chunk.id === 'project:loomstack')?.text;
    expect(live).toContain("one of Ada's own products with a public site");
    expect(live).toContain('https://pipewright.example');
    expect(live).toContain('Key features:');
    expect(concept).toContain("one of Ada's product concepts");
    expect(concept).toContain('Planned scope:');
    expect(concept).not.toContain('public site');
  });

  it('labels certifications as coursework in the passage itself', () => {
    expect(corpus.find((chunk) => chunk.id === 'certifications')?.text).toContain(
      'not professional experience',
    );
  });

  it('credits every passage of the record to a source the record labels', () => {
    for (const chunk of corpus.filter(({ category }) => category !== 'product-sites')) {
      expect(Object.keys(knowledge.sourceLabels), chunk.id).toContain(chunk.source);
    }
    expect(corpus.find((chunk) => chunk.id === 'skills:platform')?.source).toBe('cv.skills');
    expect(corpus.find((chunk) => chunk.id === 'notes:1')?.source).toBe('notes');
  });

  describe('passages of product and company sites', () => {
    const sites = corpus.filter(({ category }) => category === 'product-sites');

    it('turns every site passage into its own passage, credited to the page it was read from', () => {
      expect(sites.map(({ id, source }) => [id, source])).toEqual(
        knowledge.productSites.map(({ id, url }) => [id, siteSourceId(url)]),
      );
    });

    it("says in the passage whose site it is, so the product's claims never read as the owner's work", () => {
      expect(sites.find(({ id }) => id === 'site/pipewright/0')?.text).toBe(
        'From the public website of Pipewright (pipewright.example), describing the product itself:\n' +
          'Pipewright rebuilds only the targets a change affects. It is written in Go and caches every step remotely, so a monorepo build finishes in seconds.',
      );
      expect(sites.find(({ id }) => id === 'site/acme/0')?.text).toMatch(
        /^From the public website of Acme \(acme\.example\/about\), describing the company itself:\n/,
      );
    });

    it('refuses a site passage about something the record does not hold', () => {
      const [passage] = knowledge.productSites;
      if (!passage) throw new Error('The fixture has site passages.');
      const orphan = { ...passage, subject: { kind: 'project' as const, id: 'unknown' } };
      expect(() => buildCorpus({ ...knowledge, productSites: [orphan] })).toThrow(
        'Unknown site subject "unknown".',
      );
    });
  });
});
