import { describe, expect, it } from 'vitest';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { buildCorpus, CHUNK_CATEGORIES, type KnowledgeChunk } from './corpus';
import { localize } from './localize';
import { siteSourceId } from './product-sites';
import type { KnowledgeSource } from './schema';

const knowledge = localize(fixtureKnowledge, 'en');
const portuguese = localize(fixtureKnowledge, 'pt-BR');
const corpus = buildCorpus(fixtureKnowledge);

function passage(id: string): KnowledgeChunk {
  const found = corpus.find((chunk) => chunk.id === id);
  if (!found) throw new Error(`${id} is not in the corpus`);
  return found;
}

/** The record with one text left in English, as a translation in progress has it. */
function partlyTranslated(): KnowledgeSource {
  const [first, ...rest] = fixtureKnowledge.experience;
  if (!first) throw new Error('The fixture documents a role.');
  return {
    ...fixtureKnowledge,
    experience: [{ ...first, summary: { en: first.summary.en } }, ...rest],
  };
}

describe('knowledge corpus', () => {
  it('gives every passage a unique, stable id', () => {
    const ids = corpus.map((chunk) => chunk.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(buildCorpus(fixtureKnowledge).map((chunk) => chunk.id)).toEqual(ids);
  });

  it('files every passage under one of the declared categories, and uses all of them', () => {
    expect(new Set(corpus.map((chunk) => chunk.category))).toEqual(new Set(CHUNK_CATEGORIES));
  });

  it('turns every resume statement into its own passage, naming the company', () => {
    for (const role of knowledge.experience) {
      for (const statement of role.highlights) {
        const found = corpus.find((chunk) => chunk.text.endsWith(statement));
        expect(found, statement).toBeDefined();
        expect(found?.text).toContain(role.company);
        expect(found?.source).toBe(role.source);
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
    const live = passage('en/project:pipewright').text;
    const concept = passage('en/project:loomstack').text;
    expect(live).toContain("one of Ada's own products with a public site");
    expect(live).toContain('https://pipewright.example');
    expect(live).toContain('Key features:');
    expect(concept).toContain("one of Ada's product concepts");
    expect(concept).toContain('Planned scope:');
    expect(concept).not.toContain('public site');
  });

  it('labels certifications as coursework in the passage itself', () => {
    expect(passage('en/certifications').text).toContain('not professional experience');
  });

  it('credits every passage of the record to a source the record labels', () => {
    for (const chunk of corpus.filter(({ category }) => category !== 'product-sites')) {
      expect(Object.keys(knowledge.sourceLabels), chunk.id).toContain(chunk.source);
    }
    expect(passage('en/skills:platform').source).toBe('cv.skills');
    expect(passage('notes:1').source).toBe('notes');
  });

  describe('in every language the record is written in', () => {
    const record = corpus.filter(({ category }) => !['notes', 'product-sites'].includes(category));

    it('builds every passage of the record once in English and once in Portuguese', () => {
      const english = record.filter(({ id }) => id.startsWith('en/')).map(({ baseId }) => baseId);
      const translated = record
        .filter(({ id }) => id.startsWith('pt-BR/'))
        .map(({ baseId }) => baseId);

      expect(english.length).toBeGreaterThan(10);
      expect(translated).toEqual(english);
      expect(record).toHaveLength(english.length + translated.length);
    });

    it('says the same fact in each language, crediting the same source', () => {
      for (const chunk of record.filter(({ id }) => id.startsWith('en/'))) {
        const other = passage(`pt-BR/${chunk.baseId}`);
        expect(other.source, chunk.baseId).toBe(chunk.source);
        expect(other.category, chunk.baseId).toBe(chunk.category);
        expect(other.text, chunk.baseId).not.toBe(chunk.text);
      }
    });

    it('frames a Portuguese passage in Portuguese, around the record read in Portuguese', () => {
      const [role] = portuguese.experience;
      expect(passage('pt-BR/role:acme').text).toBe(
        `Acme — Principal Platform Engineer, ${role?.period ?? ''} (cargo atual). Lidera a plataforma interna para desenvolvedores.`,
      );
      expect(passage('pt-BR/project:loomstack').text).toContain(
        'um dos conceitos de produto de Ada',
      );
      expect(passage('pt-BR/languages').text).toBe(
        'Idiomas: Português (nativo), Inglês (fluente).',
      );
    });

    it('keeps the passages written once — notes and sites — in their own language, once', () => {
      const once = corpus.filter(({ category }) => ['notes', 'product-sites'].includes(category));
      expect(once.map(({ id }) => id)).toEqual(once.map(({ baseId }) => baseId));
      expect(once).toHaveLength(
        fixtureKnowledge.notes.passages.length + fixtureKnowledge.productSites.length,
      );
    });

    it('leaves a language out until every text of the record is written in it', () => {
      const ids = buildCorpus(partlyTranslated()).map(({ id }) => id);
      expect(ids.some((id) => id.startsWith('pt-BR/'))).toBe(false);
      expect(ids).toContain('en/role:acme');
    });
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
      const [site] = fixtureKnowledge.productSites;
      if (!site) throw new Error('The fixture has site passages.');
      const orphan = { ...site, subject: { kind: 'project' as const, id: 'unknown' } };
      expect(() => buildCorpus({ ...fixtureKnowledge, productSites: [orphan] })).toThrow(
        'Unknown site subject "unknown".',
      );
    });
  });
});
