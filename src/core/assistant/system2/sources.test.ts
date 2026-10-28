import { describe, expect, it } from 'vitest';
import { buildCorpus, type KnowledgeChunk } from '@/core/knowledge/corpus';
import { localize } from '@/core/knowledge/localize';
import type { Knowledge } from '@/core/knowledge/schema';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { createCitation } from '../citations';
import { evidenceOf, usedSources, type SourceEvidence } from './sources';

const ACME = { id: 'cv.acme', label: 'CV' };
const GLOBEX = { id: 'cv.globex', label: 'CV' };
const EDUCATION = { id: 'cv.education', label: 'CV' };
const NOTES = { id: 'notes', label: 'Knowledge base' };

const PAYROLL_LEAD: SourceEvidence = {
  source: ACME,
  text: "Acme (Principal Platform Engineer, 2022 — Present): Helped lead and maintain the payroll team responsible for the company's core HR tools product.",
};
const GLOBEX_TEAM: SourceEvidence = {
  source: GLOBEX,
  text: 'Globex (Senior Platform Engineer, 2018 — 2022): Expanded the frontend team from a solo developer setup by recruiting and integrating three additional developers.',
};
const DEGREE: SourceEvidence = {
  source: EDUCATION,
  text: 'Education: Bachelor of Computer Science, completed in 2015.',
};
const FASTER_PAGES: SourceEvidence = {
  source: ACME,
  text: 'reduced loading time on critical pages through targeted refactoring and optimization.',
};

describe('usedSources — the evidence an answer drew on', () => {
  it('keeps a source whose company the answer names, in another language than the record', () => {
    const answer =
      'Sim. Na Acme, ele ajudou a liderar a equipe de payroll; na Globex, expandiu a equipe de frontend de um para quatro desenvolvedores.';

    expect(usedSources(answer, [PAYROLL_LEAD, DEGREE, GLOBEX_TEAM])).toEqual([ACME, GLOBEX]);
  });

  it('keeps a source whose evidence the answer paraphrases', () => {
    const answer = 'he cut the loading time on critical pages through targeted refactoring.';

    expect(usedSources(answer, [FASTER_PAGES, DEGREE])).toEqual([ACME]);
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

  it('does not take a capitalized word that opens a line for a name', () => {
    const answer = 'He joined in 2022.\nAcme was where he worked.';

    expect(usedSources(answer, [PAYROLL_LEAD, DEGREE])).toEqual([]);
  });

  it('cites a source once, however many of its passages the answer used', () => {
    const answer = 'At Acme he cut loading time on critical pages through targeted refactoring.';

    expect(usedSources(answer, [PAYROLL_LEAD, FASTER_PAGES])).toEqual([ACME]);
  });
});

describe('evidenceOf — what each source of a result vouches for', () => {
  it('takes the text the action attributed to each source', () => {
    const result = {
      data: { passages: [] },
      sources: [ACME, GLOBEX],
      evidence: { 'cv.acme': PAYROLL_LEAD.text, 'cv.globex': GLOBEX_TEAM.text },
    };

    expect(evidenceOf(result)).toEqual([PAYROLL_LEAD, GLOBEX_TEAM]);
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

/** What each source vouches for when a search returns these passages of a record. */
function evidenceFrom(knowledge: Knowledge, ids?: readonly string[]): SourceEvidence[] {
  const citation = createCitation(knowledge);
  const chunks = buildCorpus(knowledge).filter((chunk) => !ids || ids.includes(chunk.id));
  const sources = [...new Set(chunks.map((chunk) => chunk.source))];
  return sources.map((id) => ({
    source: citation(id),
    text: chunks
      .filter((chunk: KnowledgeChunk) => chunk.source === id)
      .map((chunk) => chunk.text)
      .join('\n'),
  }));
}

const fixture = localize(fixtureKnowledge, 'en');
const EVERY_SOURCE = evidenceFrom(fixture);
const { firstName } = fixture.profile;

describe('usedSources — names shared by several sources do not count', () => {
  it('keeps nothing for an answer that names only the person it is about', () => {
    const answer = `This portfolio belongs to ${firstName}, who shares it.`;

    expect(usedSources(answer, EVERY_SOURCE)).toEqual([]);
  });

  it('does not keep every role for an answer that names the job title and stack', () => {
    const answer = `Today ${firstName} is a Principal Platform Engineer who works with Bazel.`;

    expect(usedSources(answer, EVERY_SOURCE)).toEqual([]);
  });

  it('keeps a source by a name only it carries', () => {
    const answer = `Before that ${firstName} studied at the Universidade do Porto.`;

    expect(usedSources(answer, EVERY_SOURCE).map(({ id }) => id)).toEqual(['cv.education']);
  });
});
