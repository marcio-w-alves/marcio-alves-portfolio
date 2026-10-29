import { describe, expect, it } from 'vitest';
import type { AssistantResponse } from '@/core/assistant/response';
import { createResponseKit } from '@/core/assistant/response-kit';
import { SCORED_INTENTS } from '@/core/assistant/system1/intents';
import { createEvidenceFinder, TECHNOLOGIES } from '@/core/assistant/system1/technologies';
import type { ResponsePart } from '@/core/chat/components';
import type { ConversationContext } from '@/core/chat/request';
import { SUPPORTED_LOCALES } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import type { Knowledge, Localized } from '@/core/knowledge/schema';
import { profile } from '.';
import { validateProfile } from './schema';

/**
 * The owner's Portuguese: written in full, saying what the English says, and
 * in Portuguese. Whether a language is published is the profile's choice;
 * these tests hold the translation to the bar it must meet before it is.
 */

function portugueseCopy() {
  const copy = profile.copy['pt-BR'];
  if (!copy) throw new Error('The profile has no Portuguese copy.');
  return copy;
}

const portuguese = portugueseCopy();
const record = localize(profile.knowledge, 'pt-BR');
const kit = createResponseKit(record);
const FRESH: ConversationContext = { topic: 'overview', lastIntent: null, ctaShown: false };

/**
 * Words only English writes. A Portuguese text holding one of them, once the
 * names written the same in both languages are taken out, was left
 * untranslated. A heuristic: a passing text still needs a reader.
 */
// Bounded by letters of any alphabet, not \b, which takes the "in" of "início"
// for a word. "for" is left out: Portuguese writes it too ("onde for útil").
const ENGLISH =
  /(?<![\p{L}-])(the|and|with|his|he|she|her|their|which|that|from|into|was|were|has|have|of|to|is|are|in|on|by|an|or|its|this|these|not|only|but|who|what|how|when|where)(?![\p{L}-])/iu;

/** Names a Portuguese text keeps as the record writes them: companies, titles, products, courses. */
function namesKeptAsWritten(knowledge: Knowledge): string[] {
  return [
    ...knowledge.experience.flatMap((role) => [role.company, ...(role.aliases ?? []), role.role]),
    ...knowledge.projects.map((project) => project.name),
    ...knowledge.certifications.flatMap((course) => [course.name, course.issuer]),
    knowledge.education.school,
    'Backend for Frontend',
    'Principal Frontend Developer',
    'Senior Full Stack Engineer',
  ].sort((a, b) => b.length - a.length);
}

const KEPT = namesKeptAsWritten(record);

/** The prose of a text: no code, no link targets, no names kept as written. */
function prose(markdown: string): string {
  const withoutCode = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/https?:\/\/\S+/g, ' ');
  return KEPT.reduce((text, name) => text.split(name).join(' '), withoutCode);
}

function englishLeftIn(texts: readonly (readonly [where: string, text: string])[]): string[] {
  return texts.flatMap(([where, text]) => {
    const word = ENGLISH.exec(prose(text))?.[0];
    return word ? [`${where}: "${word}" in "${text.slice(0, 80)}"`] : [];
  });
}

/**
 * Terms Portuguese writes as English does: loanwords of the trade and names
 * of technologies. A translation identical to its English text passes only
 * when every item of it is one of these, or a name the record keeps.
 */
const WRITTEN_ALIKE = new Set([
  'AWS',
  'Android',
  'CI/CD',
  'CSS',
  'Context API',
  'Core Web Vitals',
  'Design systems',
  'Developer Experience',
  'Formik',
  'Frontend',
  'Full stack',
  'HRIS',
  'HTML',
  'JavaScript',
  'MUI',
  'Mobile',
  'Next.js',
  'Node.js',
  'PWA',
  'Performance',
  'PostgreSQL',
  'React',
  'React.js',
  'Redis',
  'Redux',
  'SEO',
  'SSR',
  'SWR',
  'Server-Side Rendering',
  'TanStack Query',
  'Tailwind CSS',
  'TypeScript',
  'Web',
  'Web Vitals',
  'Zustand',
  'design tokens',
  'iOS',
  'iPhone (beta)',
]);

function writtenAlike(text: string): boolean {
  return text.split(/,\s*|\s+&\s+/).every((item) => WRITTEN_ALIKE.has(item) || KEPT.includes(item));
}

/** Each translation left exactly as its English text, unless it is all loanwords and names. */
function leftAsEnglish(pairs: readonly (readonly [where: string, en: string, pt: string])[]) {
  return pairs
    .filter(([, en, pt]) => pt === en && !writtenAlike(pt))
    .map(([where, en]) => `${where}: "${en}"`);
}

/** Every text of the record with its translation, and where it sits. */
function recordPairs(value: unknown, path = 'knowledge'): [string, string, string][] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => recordPairs(item, `${path}[${String(index)}]`));
  }
  if ('en' in value && typeof value.en === 'string') {
    const { en, 'pt-BR': pt = '' } = value as Localized;
    return [[path, en, pt]];
  }
  return Object.entries(value).flatMap(([key, field]) => recordPairs(field, `${path}.${key}`));
}

/** Each topic's label, and its questions' tags and chips, beside the English ones. */
function topicPairs(): [string, string, string][] {
  const english = profile.copy.en.answers.topics(
    createResponseKit(localize(profile.knowledge, 'en')),
  );
  return Object.entries(portuguese.answers.topics(kit)).flatMap(([id, topic]) => {
    const theirs = english[id as keyof typeof english];
    return [
      [`${id}.label`, theirs.label, topic.label] as [string, string, string],
      ...topic.questions.flatMap(({ tag, short }, index): [string, string, string][] => [
        [`${id}.tag`, theirs.questions[index]?.tag ?? '', tag],
        ...(short
          ? [
              [`${id}.short`, theirs.questions[index]?.short ?? '', short] as [
                string,
                string,
                string,
              ],
            ]
          : []),
      ]),
    ];
  });
}

/** Every Portuguese text of the record, with where it sits. */
function recordTexts(value: unknown, path = 'knowledge'): [string, string][] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => recordTexts(item, `${path}[${String(index)}]`));
  }
  if ('en' in value && typeof value.en === 'string') {
    const text = (value as Localized)['pt-BR'];
    return text === undefined ? [] : [[path, text]];
  }
  return Object.entries(value).flatMap(([key, field]) => recordTexts(field, `${path}.${key}`));
}

/** Every string a catalog holds, with its path. */
function catalogTexts(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, field]) => catalogTexts(field, `${path}.${key}`));
}

/** What the copy writes itself in these parts: text, notes, details and tables. */
function partTexts(where: string, parts: readonly ResponsePart[]): [string, string][] {
  const written = parts.flatMap((part): string[] => {
    if (part.type === 'text') return [part.text];
    if (part.component === 'note' || part.component === 'details') {
      return Object.values(part.props).filter((value) => typeof value === 'string');
    }
    if (part.component === 'table') {
      const { columns, rows, caption } = part.props;
      return [...columns, ...rows.flat(), caption];
    }
    return [];
  });
  return written.map((text) => [where, text]);
}

/** What an answer writes itself, its follow-ups included. */
function answerTexts(where: string, answer: AssistantResponse): [string, string][] {
  return [
    ...partTexts(where, answer.parts),
    ...answer.followUps.map((followUp): [string, string] => [where, followUp]),
  ];
}

function everyAnswer(): [string, string][] {
  const answers = portuguese.answers.answers(kit);
  const findEvidence = createEvidenceFinder(record);
  return [
    ...SCORED_INTENTS.flatMap((intent) => answerTexts(intent, answers.scored[intent](FRESH, ''))),
    ...record.languages.flatMap((language) =>
      answerTexts(`languages:${language.name}`, answers.scored.languages(FRESH, language.name)),
    ),
    ...record.experience.flatMap((role) =>
      answerTexts(`company:${role.id}`, answers.company(role.id)),
    ),
    ...record.projects.flatMap((project) =>
      answerTexts(`project:${project.id}`, answers.project(project.id)),
    ),
    ...TECHNOLOGIES.flatMap((technology) =>
      answerTexts(`technology:${technology.name}`, answers.technology([findEvidence(technology)])),
    ),
    ...answerTexts('greeting', answers.greeting()),
    ...answerTexts('identity', answers.scored.identity(FRESH, '')),
    ...answerTexts('privateInfo', answers.privateInfo()),
    ...answerTexts('offPurpose', answers.offPurpose()),
    ...answerTexts('unknown', answers.unknown()),
    ...answerTexts('slowDown', answers.slowDown([])),
  ];
}

function everyTopicText(): [string, string][] {
  return Object.entries(portuguese.answers.topics(kit)).flatMap(([id, topic]) => [
    [`${id}.label`, topic.label],
    [`${id}.intro`, topic.intro],
    [`${id}.description`, topic.description],
    ...topic.questions.flatMap(({ question, tag, short }): [string, string][] => [
      [`${id}.question`, question],
      [`${id}.tag`, tag],
      ...(short ? [[`${id}.short`, short] as [string, string]] : []),
    ]),
    ...partTexts(`${id}.page`, topic.page),
  ]);
}

describe("the owner's Portuguese", () => {
  it('has every text of the record and the copy, each stating only the figures its English does', () => {
    expect(() => validateProfile({ ...profile, locales: SUPPORTED_LOCALES })).not.toThrow();
  });

  it('leaves no text of the record or label of a page as its English, loanwords and names aside', () => {
    expect(leftAsEnglish([...recordPairs(profile.knowledge), ...topicPairs()])).toEqual([]);
  });

  it('flags a translation left as its English, so the check is not a formality', () => {
    expect(
      leftAsEnglish([
        ['planted', 'Legacy code migration', 'Legacy code migration'],
        ['loanwords', 'React, Next.js', 'React, Next.js'],
        ['translated', 'Mentoring', 'Mentoria'],
      ]),
    ).toEqual(['planted: "Legacy code migration"']);
  });

  it('leaves no English in the Portuguese record', () => {
    expect(englishLeftIn(recordTexts(profile.knowledge))).toEqual([]);
  });

  it('words the interface and the pages in Portuguese where it words them its own way', () => {
    const { ui, site } = portuguese;
    expect(englishLeftIn([...catalogTexts(ui, 'ui'), ...catalogTexts(site, 'site')])).toEqual([]);
  });

  it('writes every answer, refusal and follow-up in Portuguese', () => {
    const texts = everyAnswer();
    expect(texts.length).toBeGreaterThan(150);
    expect(englishLeftIn(texts)).toEqual([]);
  });

  it('writes every topic page in Portuguese, its description short enough for search results', () => {
    expect(englishLeftIn(everyTopicText())).toEqual([]);
    for (const [id, topic] of Object.entries(portuguese.answers.topics(kit))) {
      expect(topic.description.length, id).toBeLessThanOrEqual(160);
    }
  });

  it('writes the page about the site in Portuguese, with a description fit for search results', () => {
    const about = portuguese.about;
    if (!about) throw new Error('The Portuguese copy has no page about the site.');
    expect(englishLeftIn(catalogTexts(about, 'about'))).toEqual([]);
    expect(about.description.length).toBeLessThanOrEqual(160);
    expect(about.markdown.match(/^## /gm)).toHaveLength(
      profile.copy.en.about?.markdown.match(/^## /gm)?.length ?? 0,
    );
  });

  it('states in the page about the site exactly the figures the English page does', () => {
    const figures = (markdown = '') => [...markdown.matchAll(/\d+(?:[.,]\d+)*/g)].map(([n]) => n);
    expect(figures(portuguese.about?.markdown)).toEqual(figures(profile.copy.en.about?.markdown));
  });

  it('flags a Portuguese text that leaves English in it, so the check is not a formality', () => {
    expect(englishLeftIn([['planted', 'Ele liderou the migration da Roots.']])).toEqual([
      'planted: "the" in "Ele liderou the migration da Roots."',
    ]);
    expect(englishLeftIn([['kept', 'Liderou revisões na Shall And Partners.']])).toEqual([]);
  });
});
