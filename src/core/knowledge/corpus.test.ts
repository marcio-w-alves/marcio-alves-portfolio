import { describe, expect, it } from 'vitest';
import { buildCorpus, CHUNK_CATEGORIES } from './corpus';
import { knowledgeBase } from './knowledge-base';

const corpus = buildCorpus();

describe('knowledge corpus', () => {
  it('gives every passage a unique, stable id', () => {
    const ids = corpus.map((chunk) => chunk.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(buildCorpus().map((chunk) => chunk.id)).toEqual(ids);
  });

  it('files every passage under one of the declared categories, and uses all of them', () => {
    expect(new Set(corpus.map((chunk) => chunk.category))).toEqual(new Set(CHUNK_CATEGORIES));
  });

  it('turns every resume statement into its own passage, naming the company', () => {
    for (const role of knowledgeBase.experience) {
      for (const statement of role.highlights) {
        const passage = corpus.find((chunk) => chunk.text.endsWith(statement));
        expect(passage, statement).toBeDefined();
        expect(passage?.text).toContain(role.company);
        expect(passage?.source).toBe(role.source);
      }
    }
  });

  it('leaves contact details out, so they can only come through the contact action', () => {
    const everything = corpus.map((chunk) => chunk.text).join('\n');
    expect(everything).not.toContain(knowledgeBase.contact.email);
    expect(everything).not.toContain('linkedin.com');
  });

  it('tells a live product from a concept in the passage itself', () => {
    const live = corpus.find((chunk) => chunk.id === 'project:evcopilot')?.text;
    const concept = corpus.find((chunk) => chunk.id === 'project:fictiondraft')?.text;
    expect(live).toContain('with a public site');
    expect(live).toContain('https://evcopilotapp.io');
    expect(live).toContain('Key features:');
    expect(concept).toContain('product concepts');
    expect(concept).toContain('Planned scope:');
    expect(concept).not.toContain('public site');
  });

  it('labels certifications as coursework in the passage itself', () => {
    expect(corpus.find((chunk) => chunk.id === 'certifications')?.text).toContain(
      'not professional experience',
    );
  });
});
