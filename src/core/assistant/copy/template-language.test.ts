import { afterEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/core/i18n/locale';
import { answersFrom, firstText, say, sayAbout } from '@/testing/copy-answers';
import { textAnswer } from '@/testing/copy-variants';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { withMetric } from '@/testing/fixture-profile/variants';
import { bullets, numbered } from '../response-kit';

/**
 * The template language as a profile meets it: a template written into the
 * example's copy, compiled, and read back from the answer the fast path gives.
 */

describe('placeholders', () => {
  it('fills placeholders from paths, ids, strings and integers', () => {
    expect(say('{{first}} at {{role.acme.company}}: {{"x"}} and {{3 | words}}')).toBe(
      'Ada at Acme: x and three',
    );
    expect(sayAbout('acme', '{{practice.caseStudies[role.id].problem}}')).toBe('Slow builds.');
  });

  it("reads a role through the answer's subject and the other roles by id", () => {
    expect(sayAbout('globex', '{{role.company}} after {{role.acme.company}}')).toBe(
      'Globex after Acme',
    );
  });

  it('passes Markdown and HTML characters through unescaped', () => {
    const record = withMetric(fixtureKnowledge, 'acme-build-time', { value: '<b>&amp;' });
    expect(say('**{{metric.acme-build-time.value}}**', { record })).toBe('**<b>&amp;**');
  });
});

describe('conditions', () => {
  it('binds not tighter than and, and and tighter than or', () => {
    expect(
      say('{{#if not first == "Ada" and first == "Ada" or first == "Ada"}}Y{{else}}N{{/if}}'),
    ).toBe('Y');
    expect(say('{{#if first == "Ada" or first == "X" and first == "X"}}Y{{else}}N{{/if}}')).toBe(
      'Y',
    );
    expect(say('{{#if (first == "Ada" or first == "X") and first == "X"}}Y{{else}}N{{/if}}')).toBe(
      'N',
    );
  });

  it('compares strings with == and !=', () => {
    expect(say('{{#if first != "Ada"}}Y{{else}}N{{/if}}')).toBe('N');
    expect(say('{{#if first != "Bea"}}Y{{else}}N{{/if}}')).toBe('Y');
  });

  it('takes the first else-if branch that holds', () => {
    const template =
      '{{#if first == "X"}}one{{else if first == "Ada"}}two{{else if first == "Ada"}}three{{else}}four{{/if}}';
    expect(say(template)).toBe('two');
  });

  it('treats nothing, false, "" and [] as false, and zero as true', () => {
    const truth = (value: string) => say(`{{#if ${value}}}T{{else}}F{{/if}}`);
    expect(truth('role.acme.end')).toBe('F');
    expect(truth('role.globex.current')).toBe('F');
    expect(truth('""')).toBe('F');
    expect(truth('role.globex.leadership')).toBe('F');
    expect(truth('0')).toBe('T');
    expect(truth('"0"')).toBe('T');
    expect(truth('role.acme.current')).toBe('T');
  });

  it('asks whether a key is there with a bracket lookup, and fails on a dotted one', () => {
    expect(sayAbout('globex', '{{#if practice.caseStudies[role.id]}}Y{{else}}N{{/if}}')).toBe('N');
    expect(() => say('{{#if practice.caseStudies.globex}}Y{{/if}}')).toThrow(
      /there is no "globex"/,
    );
  });
});

describe('blocks', () => {
  it('iterates with the current item and a separator', () => {
    expect(say('{{#each experience sep=", "}}{{.company}}{{/each}}')).toBe('Acme, Globex, Initech');
  });

  it('nests blocks, each with its own current item', () => {
    expect(
      say('{{#each skills sep="; "}}{{.title}}: {{#each .items sep="/"}}{{.}}{{/each}}{{/each}}'),
    ).toBe('Platform: Bazel/Kubernetes; Languages: Go/Rust');
  });

  it('scopes #with to its value, and falls to else without one', () => {
    expect(say('{{#with experience | first}}{{.role}}{{/with}}')).toBe(
      'Principal Platform Engineer',
    );
    expect(say('{{#with role.acme.end}}{{.}}{{else}}still there{{/with}}')).toBe('still there');
  });

  it("writes bullets and numbered lists exactly as the response kit's builders do", () => {
    const companies = ['Acme', 'Globex', 'Initech'];
    expect(say('{{#bullets experience}}{{.company}}{{/bullets}}')).toBe(bullets(companies));
    expect(say('{{#numbered experience}}{{.company}}{{/numbered}}')).toBe(numbered(companies));
    expect(say('{{experience | map company | bullets}}')).toBe(bullets(companies));
  });

  it('writes nothing for an empty list', () => {
    expect(
      say(
        '[{{#each role.globex.leadership}}x{{/each}}][{{#bullets role.globex.leadership}}x{{/bullets}}]',
      ),
    ).toBe('[][]');
  });
});

describe('whitespace, comments and strings', () => {
  it('trims only where ~ asks, and only on its side', () => {
    expect(say('a  {{~ first}}  b')).toBe('aAda  b');
    expect(say('a  {{first ~}}  b')).toBe('a  Adab');
    expect(say('  a\n\n{{first}}\n\n  ')).toBe('  a\n\nAda\n\n  ');
  });

  it('renders comments as nothing and string escapes as written', () => {
    expect(say('a{{! a note for whoever edits this }}b')).toBe('ab');
    expect(say('{{"line\\nnext \\"quoted\\" back\\\\slash"}}')).toBe(
      'line\nnext "quoted" back\\slash',
    );
  });
});

describe('strictness', () => {
  const where = 'answers/planted.yaml#greeting.parts\\[0\\].text';

  // The tag under test always starts at line 3, column 16: after `Third {{"ok"}} `.
  it.each([
    ['an unknown path', '{{profile.nickname}}', /there is no "nickname"/],
    ['an unknown id', '{{role.umbrella.company}}', /there is no "umbrella"/],
    ['an object written as text', '{{profile}}', /cannot be written as text/],
    ['a filter on the wrong type', '{{first | bullets}}', /needs a list/],
  ])('fails at the line and column of %s', (_case, tag, problem) => {
    const template = `First line.\nSecond {{first}}.\nThird {{"ok"}} ${tag} end`;
    expect(() => say(template)).toThrow(new RegExp(`${where}:3:16: .*${problem.source}`));
  });

  it.each([
    ['an unknown filter', '{{first | shout}}', 7, /Unknown filter "shout"/],
    ['a filter with the wrong arity', '{{first | join}}', 7, /takes 1 argument\(s\), got 0/],
    ['an unclosed #if', '{{#if first}}x', 7, /"#if" is never closed/],
    ['a mismatched close', '{{#each experience}}x{{/if}}', 28, /"\/if" closes "#each"/],
    ['a stray else', 'x{{else}}y', 8, /"else" outside an #if or #with/],
  ])('refuses %s before anything renders', (_case, tag, column, problem) => {
    const template = `First line.\nSecond line.\nThird ${tag}`;
    expect(() => say(template)).toThrow(
      new RegExp(`${where}:3:${String(column)}: .*${problem.source}`),
    );
  });
});

describe('safety', () => {
  it.each(['{{__proto__}}', '{{profile.constructor}}', '{{role[prototype]}}'])(
    'refuses %s when parsing',
    (template) => {
      expect(() => say(template)).toThrow(/cannot be read/);
    },
  );

  it('does not read inherited properties', () => {
    expect(() => say('{{profile.toString}}')).toThrow(/there is no "toString"/);
  });

  // A filter is looked up by a name a template chose, so every name an object
  // inherits has to be as unknown as any other — refused where it is written,
  // not a function found where a filter was expected.
  it.each(['toString', 'valueOf', 'hasOwnProperty', '__defineGetter__'])(
    'refuses the inherited name %s as an unknown filter',
    (name) => {
      expect(() => say(`{{first | ${name}}}`)).toThrow(
        new RegExp(
          `answers/planted\\.yaml#greeting\\.parts\\[0\\]\\.text:1:1: Unknown filter "${name}"`,
        ),
      );
    },
  );

  it('takes a regular expression of 200 characters, not 201, and refuses an invalid one', () => {
    const pattern = (length: number) => `"${'a'.repeat(length)}"`;
    expect(say(`{{first | replace ${pattern(200)} "x"}}`)).toBe('Ada');
    expect(() => say(`{{first | replace ${pattern(201)} "x"}}`)).toThrow(/at most 200/);
    expect(() => say('{{first | replace "(" "x"}}')).toThrow(/Invalid regular expression/);
  });

  it("never sees the visitor's question", () => {
    expect(() => say('{{question}}')).toThrow(/Unknown name "question"/);
    expect(() => say('{{input}}')).toThrow(/Unknown name "input"/);
  });
});

describe('the language a visitor names', () => {
  const asked = '{{#if asked}}{{asked.name}} ({{asked.level}}){{else}}none{{/if}}';
  const context = { topic: 'overview', lastIntent: null, ctaShown: false } as const;

  function languagesAnswer(locale: Locale, question: string): string {
    const languages = answersFrom(textAnswer(asked), 'languages', { locale }).scored.languages;
    if (!languages) throw new Error('No languages answer.');
    return firstText(languages(context, question));
  }

  it("is bound by the core from the question, by each language's own notion of a word", () => {
    expect(languagesAnswer('en', 'Does she speak English?')).toBe('English (Fluent)');
    expect(languagesAnswer('en', 'Does she speak Englishes?')).toBe('none');
    expect(languagesAnswer('pt-BR', 'Ela fala inglês?')).toBe('Inglês (Fluent)');
    expect(languagesAnswer('pt-BR', 'E o português?')).toBe('Português (Native)');
    expect(languagesAnswer('en', 'What does she do?')).toBe('none');
  });
});

describe('filters', () => {
  it('writes small numbers as words per language, larger ones as digits', () => {
    expect(say('{{0 | words}} {{1 | words}} {{10 | words}} {{11 | words}}')).toBe(
      'zero one ten 11',
    );
    expect(
      say('{{0 | words}} {{1 | words}} {{10 | words}} {{11 | words}}', { locale: 'pt-BR' }),
    ).toBe('zero um dez 11');
    expect(say('{{"6s" | words}}')).toBe('six');
    expect(() => say('{{first | words}}')).toThrow(/needs a whole number/);
  });

  it('picks "a" or "an" in English and has no Portuguese form', () => {
    expect(
      say('{{"engineer" | withArticle}}, {{"lead" | withArticle}}, {{"Engineer" | withArticle}}'),
    ).toBe('an engineer, a lead, an Engineer');
    expect(() => say('{{first | withArticle}}', { locale: 'pt-BR' })).toThrow(
      /withArticle has no pt-BR form/,
    );
  });

  it('joins names as each language does', () => {
    const named = (list: string) => `{{experience | map company${list} | list}}`;
    expect(
      say(
        named(
          ' | except role.acme.company | except role.globex.company | except role.initech.company',
        ),
      ),
    ).toBe('');
    expect(say(named(' | except role.globex.company | except role.initech.company'))).toBe('Acme');
    expect(say(named(' | except role.initech.company'))).toBe('Acme and Globex');
    expect(say(named(''))).toBe('Acme, Globex and Initech');
    expect(say(named(''), { locale: 'pt-BR' })).toBe('Acme, Globex e Initech');
  });

  describe('monthYear', () => {
    const zone = process.env.TZ;
    afterEach(() => {
      process.env.TZ = zone;
    });

    it('writes the month and year in UTC, and a year alone as the year', () => {
      expect(say('{{"2026-03" | monthYear}}')).toBe('March 2026');
      expect(say('{{"2026-03" | monthYear}}', { locale: 'pt-BR' })).toBe('março de 2026');
      expect(say('{{"2026" | monthYear}}')).toBe('2026');
      process.env.TZ = 'Pacific/Kiritimati';
      const east = say('{{"2026-01" | monthYear}}');
      process.env.TZ = 'America/Sao_Paulo';
      expect(say('{{"2026-01" | monthYear}}')).toBe(east);
      expect(east).toBe('January 2026');
    });
  });

  it.each([
    ['replace', '{{first | replace "^A" "E"}}', 'Eda'],
    ['replace with a path', '{{"He plans." | replace "^He" first}}', 'Ada plans.'],
    [
      'matching',
      '{{experience | map role | matching "Platform" | join "; "}}',
      'Principal Platform Engineer; Senior Platform Engineer',
    ],
    ['matching nothing', '[{{experience | map role | matching "Chef" | join "; "}}]', '[]'],
    ['where', '{{experience | where current | map company | join ","}}', 'Acme'],
    ['whereNot', '{{experience | whereNot current | map company | join ","}}', 'Globex,Initech'],
    ['except', '{{experience | except role.acme | map company | join ","}}', 'Globex,Initech'],
    ['first of nothing', '{{#with role.globex.leadership | first}}x{{else}}none{{/with}}', 'none'],
    [
      'count',
      '{{experience | count}} {{metric | count}} {{role.globex.leadership | count}}',
      '3 3 0',
    ],
    ['capitalize', '{{"ada" | capitalize}} {{"" | capitalize}}[]', 'Ada []'],
    ['lowerFirst', '{{"Build" | lowerFirst}}', 'build'],
    [
      'lower',
      '{{first | lower}} {{experience | map company | lower | join ","}}',
      'ada acme,globex,initech',
    ],
  ])('applies %s', (_filter, template, expected) => {
    expect(say(template)).toBe(expected);
  });
});

describe('derived facts', () => {
  it("splits a role's period into its two ends", () => {
    expect(say('{{role.globex.years.from}}–{{role.globex.years.to}}, {{role.acme.years.to}}')).toBe(
      '2018–2022, Present',
    );
  });

  it("reads a metric's amount and the two sides of a change", () => {
    const record = withMetric(fixtureKnowledge, 'acme-build-time', { value: '~40%+' });
    expect(say('{{metric.acme-build-time.amount}}', { record })).toBe('40%');
    expect(
      say(
        '{{metric.globex-team.before}}→{{metric.globex-team.after}}, +{{metric.globex-team.delta | words}}',
      ),
    ).toBe('2→6, +four');
  });

  it('has no sides for a metric that is not a change', () => {
    expect(() => say('{{metric.acme-build-time.before}}')).toThrow(/there is no "before"/);
  });
});
