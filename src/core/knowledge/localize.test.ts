import { describe, expect, it } from 'vitest';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { withRole } from '@/testing/fixture-profile/variants';
import { localize } from './localize';

const knowledge = localize(fixtureKnowledge, 'en');

describe('localizing the record', () => {
  it('reads every text in the requested language', () => {
    expect(knowledge.profile.title).toBe('Principal Platform Engineer');
    expect(knowledge.experience[0]?.highlights).toEqual([
      'Cut build times by 40% with remote caching.',
    ]);
    expect(knowledge.practice.productDepth.pipewright).toBe(
      'Incremental builds over a dependency graph.',
    );
    expect(knowledge.sourceLabels['cv.acme']).toBe('CV');
  });

  it('keeps what is written once — ids, dates, values, links, names — as it is', () => {
    expect(
      knowledge.experience.map(({ id, company, start, end }) => [id, company, start, end]),
    ).toEqual([
      ['acme', 'Acme', '2022', null],
      ['globex', 'Globex', '2018', '2022'],
      ['initech', 'Initech', '2017', '2019'],
    ]);
    expect(knowledge.metrics['acme-build-time']?.value).toBe('40%');
    expect(knowledge.projects[0]?.links[0]?.url).toBe('https://pipewright.example');
    expect(knowledge.contact).toEqual(fixtureKnowledge.contact);
    expect(knowledge.notes).toEqual(fixtureKnowledge.notes);
  });

  it("writes each role's dates out the way the language writes them", () => {
    const record = withRole(fixtureKnowledge, 'globex', { start: '2018-11', end: '2026-03' });

    expect(localize(record, 'en').experience.map(({ period }) => period)).toEqual([
      '2022 — Present',
      'Nov 2018 — Mar 2026',
      '2017 — 2019',
    ]);
    expect(localize(record, 'pt-BR').experience.map(({ period }) => period)).toEqual([
      '2022 — atual',
      'nov. 2018 — mar. 2026',
      '2017 — 2019',
    ]);
  });

  it('reads a text in English until it is translated, and in the translation once it is', () => {
    const record = withRole(fixtureKnowledge, 'acme', {
      summary: { en: 'Builds the platform.', 'pt-BR': 'Constrói a plataforma.' },
    });

    expect(localize(record, 'pt-BR').experience[0]?.summary).toBe('Constrói a plataforma.');
    expect(localize(record, 'pt-BR').profile.title).toBe('Principal Platform Engineer');
    expect(localize(record, 'en').experience[0]?.summary).toBe('Builds the platform.');
  });

  it('leaves no localized text behind anywhere in the record', () => {
    expect(JSON.stringify(knowledge)).not.toMatch(/"en":/);
  });
});
