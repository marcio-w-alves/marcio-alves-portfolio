import { TOPIC_IDS } from '../../chat/topic-id';
import type { Locale } from '../../i18n/locale';
import type { Knowledge } from '@/core/knowledge/schema';
import { createResponseKit, type ResponseKit } from '../response-kit';
import { SCORED_INTENTS, isScoredIntent } from '../system1/intents';
import { answerCases, technologyEvidenceSets } from './answer-cases';
import {
  BoundCopy,
  aboutOf,
  answerSetOf,
  technologyCall,
  type Call,
  type CompileOptions,
} from './compile';
import type { CopyDocuments } from './copy-document';
import {
  CopyError,
  prepareLocaleCopy,
  type PreparedAnswer,
  type PreparedCopy,
  type PreparedPart,
  type PreparedTopic,
} from './prepare';
import { holds, renderTemplate, valueOf, type Scope } from './render';
import type { Template } from './template';
import {
  answerWriting,
  factPaths,
  literalTexts,
  stringsWriting,
  topicWriting,
  type Writing,
} from './walk';

/**
 * Proves a language's copy before anything is built from it (FR-22, AC-22.1):
 * every template parses; every path, id and key resolves against the record,
 * in every branch whether the record takes it or not; no literal text states
 * one of the record's figures; and every answer renders for every input.
 * Each problem names the document and the place it is written.
 */

export interface CheckOptions extends CompileOptions {
  /** The record read in the copy's language. */
  readonly knowledge: Knowledge;
  /** The record's figures (`recordFigures`), which only placeholders may state. */
  readonly figures: readonly string[];
}

const FRESH = { topic: 'overview', lastIntent: null, ctaShown: false } as const;

/** Runs one step of the check, turning what it throws into a problem. */
function attempt(problems: string[], step: () => void, where = ''): void {
  try {
    step();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    problems.push(where ? `${where}: ${error.message}` : error.message);
  }
}

function callsFor(answerId: string, bound: BoundCopy, knowledge: Knowledge): Call[] {
  if (isScoredIntent(answerId)) {
    const questions =
      answerId === 'languages'
        ? ['', ...knowledge.languages.map((language) => language.name)]
        : [''];
    return questions.map((question) => bound.scoredCall(answerId, FRESH, question));
  }
  if (answerId === 'company') return knowledge.experience.map((role) => bound.companyCall(role.id));
  if (answerId === 'project') {
    return knowledge.projects.map((project) => bound.projectCall(project.id));
  }
  if (answerId === 'technology') return technologyEvidenceSets(knowledge).map(technologyCall);
  return [{ intent: answerId }];
}

/** Walks every template of a part in check mode, rows included. */
function walkPart(part: PreparedPart, scope: Scope, problems: string[]): void {
  const render = (template: Template, current?: { value: unknown }) => {
    attempt(problems, () => renderTemplate(template, scope, current));
  };
  if (part.when) {
    const { when } = part;
    attempt(problems, () => holds(when, part.origin, scope));
  }
  switch (part.kind) {
    case 'text':
    case 'note': {
      render(part.text);
      return;
    }
    case 'details':
      render(part.summary);
      {
        render(part.text);
        return;
      }
    case 'table': {
      part.columns.forEach((column) => {
        render(column);
      });
      if (part.caption) render(part.caption);
      const { rows } = part;
      if (Array.isArray(rows)) {
        (rows as readonly (readonly Template[])[]).flat().forEach((cell) => {
          render(cell);
        });
        return;
      }
      const { each, cells } = rows as Extract<typeof rows, { each: unknown }>;
      let items: unknown = null;
      attempt(problems, () => {
        items = valueOf(each, `${part.origin}.rows.each`, scope);
      });
      const listed: readonly unknown[] = Array.isArray(items) ? items : [undefined];
      listed.forEach((item) => {
        cells.forEach((cell) => {
          render(cell, { value: item });
        });
      });
      return;
    }
    case 'metrics':
    case 'projects': {
      const { ids } = part;
      if (typeof ids === 'object' && 'operand' in ids) {
        attempt(problems, () => valueOf(ids, `${part.origin}.from`, scope));
      }
      return;
    }
    default:
      return;
  }
}

function walkAnswer(
  bound: BoundCopy,
  answer: PreparedAnswer,
  call: Call,
  problems: string[],
): void {
  const scope = bound.scopeFor(answer, call);
  const render = (template: Template) => {
    attempt(problems, () => renderTemplate(template, scope));
  };
  answer.parts.forEach((part) => {
    walkPart(part, scope, problems);
  });
  stringsWriting(answer.strings).templates.forEach(render);
  [...Object.values(answer.followUps.byId), answer.followUps.fallback].flat().forEach(render);
  if (answer.related) render(answer.related);
  if (typeof answer.grounded !== 'boolean') {
    const { condition, origin } = answer.grounded;
    attempt(problems, () => holds(condition, origin, scope));
  }
  answer.sources.forEach((source) => {
    if (source.kind === 'set') return;
    render(source.id);
    if (source.when) {
      const { when } = source;
      attempt(problems, () => holds(when, source.id.origin, scope));
    }
  });
}

function walkTopic(bound: BoundCopy, topic: PreparedTopic, problems: string[]): void {
  const scope = bound.scopeFor(null, { intent: topic.id });
  topic.page.forEach((part) => {
    walkPart(part, scope, problems);
  });
  topicWriting({ ...topic, page: [] }).templates.forEach((template) => {
    attempt(problems, () => renderTemplate(template, scope));
  });
}

function partIdProblems(part: PreparedPart, knowledge: Knowledge): string[] {
  const known = {
    metrics: Object.keys(knowledge.metrics),
    projects: knowledge.projects.map((project) => project.id),
    timeline: knowledge.experience.map((role) => role.id),
    skills: knowledge.skills.map((group) => group.id),
  } as const;
  const names = { metrics: 'metric', projects: 'project', timeline: 'role', skills: 'skill group' };
  if (
    part.kind !== 'metrics' &&
    part.kind !== 'projects' &&
    part.kind !== 'timeline' &&
    part.kind !== 'skills'
  ) {
    return [];
  }
  const { ids } = part;
  if (!Array.isArray(ids)) return [];
  return (ids as readonly string[])
    .filter((partId) => !known[part.kind].includes(partId))
    .map((partId) => `${part.origin}: the record has no ${names[part.kind]} "${partId}"`);
}

function byIdProblems(answer: PreparedAnswer, knowledge: Knowledge): string[] {
  const subjects =
    answer.id === 'company'
      ? knowledge.experience.map((role) => role.id)
      : answer.id === 'project'
        ? knowledge.projects.map((project) => project.id)
        : null;
  const origin = `${answer.document}#${answer.id}`;
  const keyed = [
    ...Object.keys(answer.followUps.byId).map((key) => ({ key, at: `followUps.byId.${key}` })),
    ...Object.entries(answer.strings).flatMap(([name, variant]) =>
      Object.keys(variant.byId).map((key) => ({ key, at: `strings.${name}.byId.${key}` })),
    ),
  ];
  return keyed.flatMap(({ key, at }) => {
    if (!subjects) return [`${origin}.${at}: byId belongs to the company and project answers`];
    return subjects.includes(key)
      ? []
      : [`${origin}.${at}: the record has no "${key}" to be about`];
  });
}

function idProblems(copy: PreparedCopy, knowledge: Knowledge): string[] {
  const groups = knowledge.skills.map((group) => group.id);
  return [
    ...[...copy.answers.values()].flatMap((answer) => [
      ...answer.parts.flatMap((part) => partIdProblems(part, knowledge)),
      ...byIdProblems(answer, knowledge),
      ...answer.fallbackSkillGroups
        .filter((group) => !groups.includes(group))
        .map(
          (group) =>
            `${answer.document}#${answer.id}.fallbackSkillGroups: the record has no skill group "${group}"`,
        ),
    ]),
    ...TOPIC_IDS.flatMap((topic) =>
      copy.topics[topic].page.flatMap((part) => partIdProblems(part, knowledge)),
    ),
  ];
}

function staticProblems(copy: PreparedCopy, kit: ResponseKit): string[] {
  const problems: string[] = [];
  const bound = new BoundCopy(copy, kit, 'check');
  for (const [answerId, answer] of copy.answers) {
    attempt(problems, () => {
      for (const call of callsFor(answerId, bound, kit.knowledge)) {
        walkAnswer(bound, answer, call, problems);
      }
    });
  }
  TOPIC_IDS.forEach((topic) => {
    walkTopic(bound, copy.topics[topic], problems);
  });
  return [...new Set([...problems, ...idProblems(copy, kit.knowledge)])];
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function everyTemplate(copy: PreparedCopy): Template[] {
  const about: Template[] = copy.about
    ? [copy.about.label, copy.about.title, copy.about.description, copy.about.markdown]
    : [];
  return [
    ...[...copy.answers.values()].flatMap((answer) => answerWriting(answer).templates),
    ...TOPIC_IDS.flatMap((topic) => topicWriting(copy.topics[topic]).templates),
    ...stringsWriting(copy.strings).templates,
    ...about,
  ];
}

function figureProblems(copy: PreparedCopy, figures: readonly string[]): string[] {
  const patterns = figures.map((figure) => ({
    figure,
    pattern: new RegExp(`(?<![\\d.])${escaped(figure)}(?!\\d)`),
  }));
  return everyTemplate(copy).flatMap((template) => {
    const written = literalTexts(template.nodes).join('\n');
    return patterns
      .filter(({ pattern }) => pattern.test(written))
      .map(
        ({ figure }) =>
          `${template.origin}: writes the record's figure "${figure}" literally — name it with a placeholder`,
      );
  });
}

function renderProblems(copy: PreparedCopy, kit: ResponseKit, options: CompileOptions): string[] {
  const problems: string[] = [];
  const answerSet = answerSetOf(copy);
  const answers = answerSet.answers(kit);
  for (const entry of answerCases(kit.knowledge)) {
    attempt(problems, () => entry.respond(answers), entry.key);
  }
  attempt(problems, () => answerSet.topics(kit), 'topics');
  attempt(problems, () => aboutOf(copy, options), 'about');
  return problems;
}

/**
 * The router scores every intent from its own generic rules, whatever a
 * profile writes, so an intent with no answer is one the fast path hands to
 * the model. That is a choice a profile may make, and `omit` in facts.yaml is
 * how it says so; an intent that is simply missing — a renamed file, a lost
 * key, a bad merge — would otherwise cost money quietly.
 */
function intentProblems(copy: PreparedCopy): string[] {
  const omitted = new Set<string>(copy.omitted);
  const missing = SCORED_INTENTS.filter(
    (intent) => !copy.answers.has(intent) && !omitted.has(intent),
  ).map(
    (intent) =>
      `answers/: no answer writes the "${intent}" intent, which the router still recognizes, so ` +
      'those questions would go to the model. Write it, or name it in facts.yaml#omit to say the ' +
      'omission is meant.',
  );
  const answered = copy.omitted
    .filter((intent) => copy.answers.has(intent))
    .map(
      (intent) =>
        `facts.yaml#omit: "${intent}" is named as omitted, but an answer writes it — remove it ` +
        'from omit, or remove the answer.',
    );
  return [...missing, ...answered];
}

/** Every problem with one language's copy over its record; empty when it can ship. */
export function checkLocaleCopy(documents: CopyDocuments, options: CheckOptions): string[] {
  let copy: PreparedCopy;
  try {
    copy = prepareLocaleCopy(documents, options.locale);
  } catch (error) {
    if (error instanceof CopyError) return [...error.problems];
    throw error;
  }
  const kit = createResponseKit(options.knowledge, copy.labels);
  return [
    ...intentProblems(copy),
    ...staticProblems(copy, kit),
    ...figureProblems(copy, options.figures),
    ...renderProblems(copy, kit, options),
  ];
}

function sameFacts(
  english: Writing,
  translation: Writing,
  where: string,
  locale: Locale,
): string[] {
  const expected = factPaths(english);
  const actual = factPaths(translation);
  const added = [...actual].filter((path) => !expected.has(path));
  const missing = [...expected].filter((path) => !actual.has(path));
  if (added.length === 0 && missing.length === 0) return [];
  const differences = [
    ...(added.length > 0 ? [`names ${added.join(', ')}, which English does not`] : []),
    ...(missing.length > 0 ? [`leaves out ${missing.join(', ')}, which English names`] : []),
  ].join('; ');
  return [
    `${where}: the ${locale} copy ${differences} — say the same facts, or why not in factsDiffer`,
  ];
}

/**
 * A translation answers what English answers and names the same facts in
 * each answer and topic, unless it says why not (`factsDiffer`).
 */
export function checkCopyAlignment(
  english: CopyDocuments,
  translation: CopyDocuments,
  locale: Locale,
): string[] {
  let source: PreparedCopy;
  let target: PreparedCopy;
  try {
    source = prepareLocaleCopy(english, 'en');
    target = prepareLocaleCopy(translation, locale);
  } catch (error) {
    if (error instanceof CopyError) return [...error.problems];
    throw error;
  }
  const missing = [...source.answers.keys()]
    .filter((answerId) => !target.answers.has(answerId))
    .map(
      (answerId) => `answers/: the ${locale} copy has no "${answerId}" answer, which English has`,
    );
  const extra = [...target.answers.keys()]
    .filter((answerId) => !source.answers.has(answerId))
    .map(
      (answerId) =>
        `answers/: the ${locale} copy has a "${answerId}" answer, which English has not`,
    );
  const answers = [...target.answers.values()].flatMap((answer) => {
    const twin = source.answers.get(answer.id);
    if (!twin || answer.factsDiffer) return [];
    return sameFacts(
      answerWriting(twin),
      answerWriting(answer),
      `${answer.document}#${answer.id}`,
      locale,
    );
  });
  const topics = TOPIC_IDS.flatMap((topic) =>
    target.topics[topic].factsDiffer
      ? []
      : sameFacts(
          topicWriting(source.topics[topic]),
          topicWriting(target.topics[topic]),
          `topics.yaml#${topic}`,
          locale,
        ),
  );
  return [...missing, ...extra, ...answers, ...topics];
}
