import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { exampleCopy } from '@/testing/copy-documents';
import { textAnswer, withAnswer, withDocument } from '@/testing/copy-variants';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { createResponseKit } from '../response-kit';
import { createEvidenceFinder, TECHNOLOGIES } from '../system1/technologies';
import type { CopyDocuments } from './copy-document';
import { compileLocaleCopy } from './compile';

/** What the core decides when it compiles a profile's copy, whatever the words. */

const knowledge = localize(fixtureKnowledge, 'en');

function compile(documents: CopyDocuments) {
  return compileLocaleCopy(documents, {
    locale: 'en',
    limits: { maxRounds: 4 },
    identity: { sourceRepository: 'https://code.example/ada' },
  });
}

function answersOf(documents: CopyDocuments) {
  const { answers } = compile(documents);
  return answers.answers(createResponseKit(knowledge, answers.labels));
}

const example = () => exampleCopy('en');

function evidenceFor(name: string) {
  const technology = TECHNOLOGIES.find((item) => item.name === name);
  if (!technology) throw new Error(`No technology "${name}".`);
  return createEvidenceFinder(knowledge)(technology);
}

describe('citing a technology', () => {
  const technology = {
    ...textAnswer('{{#each evidence sep=", "}}{{.technology.name}}{{/each}}'),
    sources: ['$evidence'],
    fallbackSkillGroups: ['platform'],
    grounded: 'documented',
  };
  const answer = (names: readonly string[]) =>
    answersOf(withAnswer(example(), 'technology', technology)).technology(names.map(evidenceFor));
  const ids = (names: readonly string[]) => answer(names).sources.map((source) => source.id);

  it('cites where a documented technology appears, and nothing it shows instead', () => {
    expect(ids(['Kubernetes'])).toEqual(['cv.skills']);
    expect(answer(['Kubernetes']).grounded).toBe(true);
  });

  it('cites the skill groups shown instead of an undocumented one, then its coursework', () => {
    expect(ids(['Terraform'])).toEqual(['cv.skills', 'cv.courses']);
    expect(ids(['Vue'])).toEqual(['cv.skills']);
    expect(answer(['Vue']).grounded).toBe(false);
  });

  it('cites a documented and an undocumented technology without the stand-in groups', () => {
    expect(ids(['Kubernetes', 'Terraform'])).toEqual(['cv.skills', 'cv.courses']);
  });
});

describe('a visitor who has to slow down', () => {
  it("is offered the copy's follow-ups when none are suggested, and the suggestions otherwise", () => {
    const answers = answersOf(example());
    expect(answers.slowDown([]).followUps).toEqual([
      "Tell me about Ada's career.",
      'Which skills does she have?',
      'How can I contact Ada?',
    ]);
    expect(answers.slowDown(['Next question?']).followUps).toEqual(['Next question?']);
    expect(answers.slowDown([]).intent).toBe('rateLimited');
  });
});

describe('an intent the copy leaves out', () => {
  it('has no answer, while the others keep theirs', () => {
    const documents = withDocument(example(), 'answers/answers.yaml', (answers) => {
      const { awards: _awards, ...kept } = answers;
      return kept;
    });
    const { scored } = answersOf(documents);
    expect(scored.awards).toBeUndefined();
    expect(scored.career).toBeTypeOf('function');
  });
});

describe('the documents', () => {
  it.each([
    [
      'a document outside the layout',
      (documents: CopyDocuments) => ({ ...documents, 'notes.yaml': {} }),
      'notes.yaml: not a copy document',
    ],
    [
      'an answer the assistant does not give',
      (documents: CopyDocuments) => withAnswer(documents, 'weather', textAnswer('Sunny.')),
      'answers/planted.yaml#weather: "weather" is not an answer the assistant gives',
    ],
    [
      'an answer written twice',
      (documents: CopyDocuments) => ({
        ...documents,
        'answers/again.yaml': { greeting: textAnswer('Hi.') },
      }),
      'answers/again.yaml#greeting: the answer is also written in answers/answers.yaml',
    ],
    [
      'a missing answer the core needs',
      (documents: CopyDocuments) =>
        withDocument(documents, 'answers/answers.yaml', (answers) => {
          const { company: _company, ...kept } = answers;
          return kept;
        }),
      'answers/: the copy needs a "company" answer',
    ],
    [
      'a missing topic',
      (documents: CopyDocuments) =>
        withDocument(documents, 'topics.yaml', (topics) => {
          const { education: _education, ...kept } = topics;
          return kept;
        }),
      'topics.yaml#education:',
    ],
    [
      'an invalid vocabulary pattern',
      (documents: CopyDocuments) =>
        withDocument(documents, 'vocabulary.yaml', () => ({
          leadRole: [{ pattern: '(payroll', weight: 3 }],
        })),
      'vocabulary.yaml#leadRole[0].pattern: "(payroll" is not a valid regular expression',
    ],
    [
      'a vocabulary flag other than i and u',
      (documents: CopyDocuments) =>
        withDocument(documents, 'vocabulary.yaml', () => ({
          leadRole: [{ pattern: 'payroll', weight: 3, flags: 'g' }],
        })),
      'vocabulary.yaml#leadRole[0].flags: Flags may only be i and u',
    ],
  ])('refuses %s, naming where', (_case, edit, problem) => {
    expect(() => compile(edit(example()))).toThrow(problem);
  });

  it('turns vocabulary into the rules the router adds, with their flags', () => {
    const documents = withDocument(example(), 'vocabulary.yaml', () => ({
      leadRole: [{ pattern: 'payroll', weight: 3, flags: 'iu' }],
    }));
    expect(compile(documents).answers.vocabulary).toEqual({ leadRole: [[/payroll/iu, 3]] });
  });

  it("renders the about page with the assistant's limits and the site's repository", () => {
    const documents = {
      ...example(),
      'about.yaml': {
        label: 'About',
        title: 'How it is built',
        description: 'A short note.',
        markdown:
          'At most {{limits.maxRounds}} rounds. Code: {{identity.sourceRepository}}. Hi, {firstName}.',
      },
    };
    expect(compile(documents).about).toEqual({
      label: 'About',
      title: 'How it is built',
      description: 'A short note.',
      markdown: 'At most 4 rounds. Code: https://code.example/ada. Hi, {firstName}.',
    });
  });

  it('refuses an about page that names something it cannot read', () => {
    const documents = {
      ...example(),
      'about.yaml': { label: 'About', title: 'T', description: 'D', markdown: '{{profile.name}}' },
    };
    expect(() => compile(documents)).toThrow('about.yaml#markdown:1:1: Unknown name "profile"');
  });
});
