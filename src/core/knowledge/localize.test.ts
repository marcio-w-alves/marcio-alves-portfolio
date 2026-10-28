import { describe, expect, it } from 'vitest';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
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
      ['acme', 'Acme', 2022, null],
      ['globex', 'Globex', 2018, 2022],
      ['initech', 'Initech', 2017, 2019],
    ]);
    expect(knowledge.metrics['acme-build-time']?.value).toBe('40%');
    expect(knowledge.projects[0]?.links[0]?.url).toBe('https://pipewright.example');
    expect(knowledge.contact).toEqual(fixtureKnowledge.contact);
    expect(knowledge.notes).toEqual(fixtureKnowledge.notes);
  });

  it('leaves no localized text behind anywhere in the record', () => {
    expect(JSON.stringify(knowledge)).not.toMatch(/"en":/);
  });
});
