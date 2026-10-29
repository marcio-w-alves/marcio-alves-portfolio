import { describe, expect, it } from 'vitest';
import type { Locale } from '@/core/i18n/locale';
import { recordFigures } from '@/core/knowledge/figures';
import { localize } from '@/core/knowledge/localize';
import { exampleCopy } from '@/testing/copy-documents';
import { textAnswer, withAnswer, withDocument, withoutAnswer } from '@/testing/copy-variants';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import type { CopyDocuments } from './copy-document';
import { checkCopyAlignment, checkLocaleCopy } from './check';

/** The checks a profile's copy passes before anything is built from it. */

function problems(documents: CopyDocuments, locale: Locale = 'en'): string[] {
  return checkLocaleCopy(documents, {
    locale,
    limits: {},
    identity: {},
    knowledge: localize(fixtureKnowledge, locale),
    figures: recordFigures(fixtureKnowledge),
  });
}

const example = (locale: Locale = 'en') => exampleCopy(locale);
const planted = 'answers/planted.yaml';

describe('the example copy', () => {
  it.each(['en', 'pt-BR'] as const)('passes every check in %s', (locale) => {
    expect(problems(example(locale))).toEqual([]);
  });
});

describe('an intent the copy stops answering', () => {
  const withoutLeadRole = () => withoutAnswer(example(), 'leadRole');

  it('fails, because the router still recognizes it', () => {
    expect(problems(withoutLeadRole())).toEqual([
      'answers/: no answer writes the "leadRole" intent, which the router still recognizes, so those questions would go to the model. Write it, or name it in facts.yaml#omit to say the omission is meant.',
    ]);
  });

  it('passes once the copy says the omission is meant', () => {
    const documents = withDocument(withoutLeadRole(), 'facts.yaml', (facts) => ({
      ...facts,
      omit: ['leadRole'],
    }));
    expect(problems(documents)).toEqual([]);
  });

  it('fails when the copy both omits and answers it', () => {
    const documents = withDocument(example(), 'facts.yaml', (facts) => ({
      ...facts,
      omit: ['leadRole'],
    }));
    expect(problems(documents)).toEqual([
      'facts.yaml#omit: "leadRole" is named as omitted, but an answer writes it — remove it from omit, or remove the answer.',
    ]);
  });

  it('refuses a name that is not an intent at all', () => {
    const documents = withDocument(example(), 'facts.yaml', (facts) => ({
      ...facts,
      omit: ['weather'],
    }));
    expect(problems(documents)).toContainEqual(expect.stringContaining('facts.yaml#omit[0]'));
  });
});

describe('templates that state or invent facts (AC-22.1)', () => {
  it('fail on a role the record lacks, naming the template', () => {
    const found = problems(
      withAnswer(example(), 'greeting', textAnswer('{{role.missing.company}}')),
    );
    expect(found).toContainEqual(
      expect.stringMatching(/^answers\/planted\.yaml#greeting\.parts\[0\]\.text:1:1: .*"missing"/),
    );
  });

  it('fail on a byId key that is not one of the record’s roles', () => {
    const company = {
      ...textAnswer('{{strings.intro}}'),
      strings: { intro: { byId: { umbrella: 'At Umbrella.' }, default: 'At {{role.company}}.' } },
    };
    expect(problems(withAnswer(example(), 'company', company))).toEqual([
      `${planted}#company.strings.intro.byId.umbrella: the record has no "umbrella" to be about`,
    ]);
  });

  it('fail on an id a part lists that the record lacks', () => {
    const answer = {
      ...textAnswer('Results:'),
      parts: [{ metrics: ['acme-build-time', 'umbrella'] }],
    };
    expect(problems(withAnswer(example(), 'achievements', answer))).toContainEqual(
      `${planted}#achievements.parts[0]: the record has no metric "umbrella"`,
    );
  });

  it.each([
    ['a metric', 'Builds got 40% faster.', '40%'],
    ['a year', 'Building platforms since 2012.', '2012'],
  ])('fail on %s written literally', (_kind, text, figure) => {
    expect(problems(withAnswer(example(), 'greeting', textAnswer(text)))).toEqual([
      `${planted}#greeting.parts[0].text: writes the record's figure "${figure}" literally — name it with a placeholder`,
    ]);
  });

  it('fail on an unknown path inside a branch the record does not take', () => {
    const template = '{{#if role.globex.current}}{{profile.nickname}}{{/if}}Hello.';
    expect(problems(withAnswer(example(), 'greeting', textAnswer(template)))).toContainEqual(
      expect.stringMatching(/greeting\.parts\[0\]\.text:1:28: .*"nickname"/),
    );
  });

  it('pass a figure that only a condition compares with', () => {
    const template = '{{#if metric.acme-build-time.value == "40%"}}Fast builds.{{/if}}';
    expect(problems(withAnswer(example(), 'greeting', textAnswer(template)))).toEqual([]);
  });
});

describe('rendering every answer for every input', () => {
  it('names the one role a template fails for, and only that one', () => {
    const company = textAnswer(
      '{{role.company}}{{#if role.engagement == "contract"}}: {{role.metrics | first}}{{/if}}',
    );
    const found = problems(withAnswer(example(), 'company', company));
    expect(found).toEqual([
      `company:initech: ${planted}#company.parts[0].text:1:56: Nothing to write here`,
    ]);
  });

  it('requires a string for every key a template looks one up by', () => {
    const philosophy = {
      ...textAnswer('{{#each principles}}{{strings.inPractice[.title]}}{{/each}}'),
      strings: { inPractice: { 'Another principle': 'Somewhere.' } },
    };
    expect(problems(withAnswer(example(), 'philosophy', philosophy))).toContainEqual(
      expect.stringMatching(/philosophy\.parts\[0\]\.text:1:21: .*there is no "Paved roads"/),
    );
  });
});

describe('extractions', () => {
  function withExtraction(pattern: string): CopyDocuments {
    const documents = withDocument(example(), 'facts.yaml', () => ({
      extract: { level: { from: 'experience | map role', pattern, groups: ['word'] } },
    }));
    return withAnswer(documents, 'greeting', textAnswer('{{extract.level.word}}'));
  }

  it.each([
    ['no role', 'Chef', 0],
    ['two roles', '(\\w+) Platform', 2],
  ])('refuse a pattern matching %s', (_case, pattern, times) => {
    expect(problems(withExtraction(pattern))).toContainEqual(
      `greeting: facts.yaml#extract.level:1:1: The pattern matches ${String(times)} times in the record; it must match exactly once`,
    );
  });

  it('give the groups of a pattern matching exactly once', () => {
    expect(problems(withExtraction('(Principal) Platform'))).toEqual([]);
  });
});

describe('a translation beside its English copy', () => {
  const align = (english: CopyDocuments, portuguese: CopyDocuments) =>
    checkCopyAlignment(english, portuguese, 'pt-BR');

  it('passes for the example', () => {
    expect(align(example('en'), example('pt-BR'))).toEqual([]);
  });

  it('must answer what English answers, and no more', () => {
    expect(align(example('en'), withoutAnswer(example('pt-BR'), 'awards'))).toEqual([
      'answers/: the pt-BR copy has no "awards" answer, which English has',
    ]);
    expect(align(withoutAnswer(example('en'), 'awards'), example('pt-BR'))).toEqual([
      'answers/: the pt-BR copy has a "awards" answer, which English has not',
    ]);
  });

  it('must name the same facts, unless it says why not', () => {
    // The English greeting names the profile's name, and its first name in the follow-ups.
    const greeting = {
      ...textAnswer('Olá — {{profile.name}}, {{profile.title}}.'),
      followUps: ['Como falar com a {{first}}?'],
    };
    expect(align(example('en'), withAnswer(example('pt-BR'), 'greeting', greeting))).toEqual([
      `${planted}#greeting: the pt-BR copy names profile.title, which English does not — say the same facts, or why not in factsDiffer`,
    ]);
    const explained = { ...greeting, factsDiffer: 'Portuguese greets with the title.' };
    expect(align(example('en'), withAnswer(example('pt-BR'), 'greeting', explained))).toEqual([]);
  });

  it('refuses an empty reason', () => {
    const blank = { ...textAnswer('Olá — {{profile.name}}.'), factsDiffer: ' ' };
    expect(align(example('en'), withAnswer(example('pt-BR'), 'greeting', blank))).toContainEqual(
      `${planted}#greeting.factsDiffer: Say why the facts differ`,
    );
  });
});
