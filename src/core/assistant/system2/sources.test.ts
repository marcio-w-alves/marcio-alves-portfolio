import { describe, expect, it } from 'vitest';
import { evidenceOf, usedSources, type SourceEvidence } from './sources';

const DEEL = { id: 'resume.deel', label: 'Resume' };
const ROOTS = { id: 'resume.roots', label: 'Resume' };
const EDUCATION = { id: 'resume.education', label: 'Resume' };
const NOTES = { id: 'notes', label: 'Knowledge base' };

const HRIS_LEAD: SourceEvidence = {
  source: DEEL,
  text: "Deel (Senior Frontend Engineer, 2022 — 2026): Helped lead and maintain the HRIS team responsible for the company's core HR tools product.",
};
const ROOTS_TEAM: SourceEvidence = {
  source: ROOTS,
  text: 'Roots (Lead Frontend Engineer, 2020 — 2022): Expanded the frontend team from a solo developer setup by recruiting and integrating three additional developers.',
};
const DEGREE: SourceEvidence = {
  source: EDUCATION,
  text: 'Education: Bachelor of Computer Science, completed in 2015.',
};
const FASTER_PAGES: SourceEvidence = {
  source: DEEL,
  text: 'reduced loading time on critical pages through targeted refactoring and optimization.',
};

describe('usedSources — the evidence an answer drew on', () => {
  it('keeps a source whose company the answer names, in another language than the record', () => {
    const answer =
      'Sim. Na Deel, ele ajudou a liderar a equipe de HRIS; na Roots, expandiu a equipe de frontend de um para quatro desenvolvedores.';

    expect(usedSources(answer, [HRIS_LEAD, DEGREE, ROOTS_TEAM])).toEqual([DEEL, ROOTS]);
  });

  it('keeps a source whose evidence the answer paraphrases', () => {
    const answer = 'he cut the loading time on critical pages through targeted refactoring.';

    expect(usedSources(answer, [FASTER_PAGES, DEGREE])).toEqual([DEEL]);
  });

  it('drops a source that shares a single run of words with the answer', () => {
    const answer = 'his work reduced loading time considerably.';

    expect(usedSources(answer, [FASTER_PAGES])).toEqual([]);
  });

  it('drops a source the answer shares nothing with', () => {
    expect(usedSources('he enjoys long walks with his dogs.', [FASTER_PAGES, DEGREE])).toEqual([]);
  });

  it('does not take a capitalized word that merely opens a sentence for a name', () => {
    const notes: SourceEvidence = { source: NOTES, text: 'Ele gosta de música. Ele joga futebol.' };

    expect(usedSources('Ele liderou a equipe.', [notes])).toEqual([]);
  });

  it('cites a source once, however many of its passages the answer used', () => {
    const answer = 'At Deel he cut loading time on critical pages through targeted refactoring.';

    expect(usedSources(answer, [HRIS_LEAD, FASTER_PAGES])).toEqual([DEEL]);
  });
});

describe('evidenceOf — what each source of a result vouches for', () => {
  it('takes the text the action attributed to each source', () => {
    const result = {
      data: { passages: [] },
      sources: [DEEL, ROOTS],
      evidence: { 'resume.deel': HRIS_LEAD.text, 'resume.roots': ROOTS_TEAM.text },
    };

    expect(evidenceOf(result)).toEqual([HRIS_LEAD, ROOTS_TEAM]);
  });

  it("backs a source the action did not attribute with the result's values, not its field names", () => {
    const result = {
      data: {
        degree: 'Bachelor of Computer Science',
        year: 2015,
        languages: [{ name: 'English' }],
      },
      sources: [EDUCATION],
    };

    expect(evidenceOf(result)).toEqual([
      { source: EDUCATION, text: 'Bachelor of Computer Science\n2015\nEnglish' },
    ]);
  });
});
