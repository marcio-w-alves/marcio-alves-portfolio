import type { z } from 'zod';
import { TOPIC_IDS, type TopicId } from '../../chat/topic-id';
import type { Locale } from '../../i18n/locale';
import type { AnswerLabels } from '../answer-labels';
import type { NoteTone } from '../../chat/components';
import type { Rule, Vocabulary } from '../system1/intents';
import {
  FIXED_ANSWERS,
  type FixedAnswer,
  aboutDocumentSchema,
  answersDocumentSchema,
  factsDocumentSchema,
  labelsDocumentSchema,
  overridesDocumentSchema,
  topicsDocumentSchema,
  vocabularyDocumentSchema,
  type AnswerDocument,
  type CatalogOverrides,
  type CopyDocuments,
  type PartDocument,
  type TopicDocument,
} from './copy-document';
import {
  TemplateError,
  parseCondition,
  parsePipeline,
  parseTemplate,
  type Condition,
  type Pipeline,
  type Template,
} from './template';

/**
 * Reads one language's copy documents into parsed templates, collecting every
 * problem — a malformed document, a template that does not parse — by its
 * document and place, so a profile is told everything wrong at once.
 */

export class CopyError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`The copy has ${String(problems.length)} problem(s):\n${problems.join('\n')}`);
    this.name = 'CopyError';
  }
}

/** A value that may differ by the id of the answer's subject. */
export interface Variant<T> {
  readonly byId: Readonly<Record<string, T>>;
  readonly fallback: T;
}

export type IdList = 'all' | readonly string[];

export type PreparedPart = { readonly when?: Condition; readonly origin: string } & (
  | { readonly kind: 'text'; readonly text: Template }
  | { readonly kind: 'note'; readonly tone: NoteTone; readonly text: Template }
  | { readonly kind: 'details'; readonly summary: Template; readonly text: Template }
  | {
      readonly kind: 'table';
      readonly columns: readonly Template[];
      readonly rows:
        | readonly (readonly Template[])[]
        | { readonly each: Pipeline; readonly cells: readonly Template[] };
      readonly caption?: Template;
    }
  | { readonly kind: 'metrics' | 'projects'; readonly ids: IdList | Pipeline }
  | { readonly kind: 'timeline' | 'skills'; readonly ids: IdList }
  | { readonly kind: 'contactCard' | 'contactOnce' }
);

export type PreparedSource =
  | { readonly kind: 'set'; readonly set: SourceSet; readonly origin: string }
  | { readonly kind: 'id'; readonly id: Template; readonly when?: Condition };

export type SourceSet = '$roles' | '$sites' | '$evidence';
const SOURCE_SETS = new Set<string>(['$roles', '$sites', '$evidence']);

export type StringValue = Template | Readonly<Record<string, Template>>;

export interface PreparedAnswer {
  readonly id: string;
  readonly document: string;
  readonly parts: readonly PreparedPart[];
  readonly followUps: Variant<readonly Template[]>;
  readonly sources: readonly PreparedSource[];
  readonly related?: Template;
  readonly grounded: boolean | { readonly condition: Condition; readonly origin: string };
  readonly strings: Readonly<Record<string, Variant<StringValue>>>;
  readonly fallbackSkillGroups: readonly string[];
  readonly factsDiffer?: string;
}

export interface PreparedTopic {
  readonly id: TopicId;
  readonly label: Template;
  readonly intro: Template;
  readonly description: Template;
  readonly questions: readonly {
    readonly question: Template;
    readonly tag: Template;
    readonly short?: Template;
  }[];
  readonly page: readonly PreparedPart[];
  readonly factsDiffer?: string;
}

export interface PreparedExtraction {
  readonly origin: string;
  readonly from: Pipeline;
  readonly pattern: RegExp;
  readonly groups: readonly string[];
}

export interface PreparedAbout {
  readonly label: Template;
  readonly title: Template;
  readonly description: Template;
  readonly markdown: Template;
}

export interface PreparedCopy {
  readonly locale: Locale;
  readonly answers: ReadonlyMap<string, PreparedAnswer>;
  /** The answers the core always gives, by name. */
  readonly fixed: Readonly<Record<FixedAnswer, PreparedAnswer>>;
  readonly topics: Readonly<Record<TopicId, PreparedTopic>>;
  readonly vocabulary: Vocabulary;
  readonly labels: AnswerLabels;
  readonly extract: Readonly<Record<string, PreparedExtraction>>;
  readonly strings: Readonly<Record<string, Variant<StringValue>>>;
  readonly ui: CatalogOverrides;
  readonly site: CatalogOverrides;
  readonly about?: PreparedAbout;
}

const SINGLE_DOCUMENTS = [
  'topics.yaml',
  'vocabulary.yaml',
  'labels.yaml',
  'facts.yaml',
  'ui.yaml',
  'site.yaml',
  'about.yaml',
];
const ANSWER_DOCUMENT = /^answers\/[A-Za-z0-9][A-Za-z0-9._-]*\.yaml$/;

function pointer(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) =>
      typeof key === 'number' ? `[${String(key)}]` : `${index === 0 ? '' : '.'}${String(key)}`,
    )
    .join('');
}

const EMPTY_TEMPLATE: Template = { origin: '', nodes: [] };
const ALWAYS: Condition = { kind: 'and', items: [] };

/** One pass over a language's documents, remembering every problem it meets. */
class Preparation {
  readonly problems: string[] = [];

  constructor(readonly locale: Locale) {}

  decode<T>(document: string, schema: z.ZodType<T>, value: unknown): T | null {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      this.problems.push(`${document}#${pointer(issue.path)}: ${issue.message}`);
    }
    return null;
  }

  private attempt<T>(read: () => T, fallback: T): T {
    try {
      return read();
    } catch (error) {
      if (!(error instanceof TemplateError)) throw error;
      this.problems.push(error.message);
      return fallback;
    }
  }

  template(source: string, origin: string): Template {
    return this.attempt(() => parseTemplate(source, origin, this.locale), EMPTY_TEMPLATE);
  }

  condition(source: string, origin: string): Condition {
    return this.attempt(() => parseCondition(source, origin, this.locale), ALWAYS);
  }

  pipeline(source: string, origin: string): Pipeline {
    return this.attempt(() => parsePipeline(source, origin, this.locale), {
      operand: { kind: 'string', value: '' },
      filters: [],
    });
  }

  regex(source: string, flags: string, origin: string): RegExp {
    try {
      return new RegExp(source, flags);
    } catch {
      this.problems.push(`${origin}: "${source}" is not a valid regular expression`);
      return /$^/;
    }
  }

  variant<In, Out>(
    value: In | { readonly byId: Readonly<Record<string, In>>; readonly default: In },
    origin: string,
    read: (item: In, at: string) => Out,
  ): Variant<Out> {
    if (typeof value === 'object' && value !== null && 'byId' in value && 'default' in value) {
      return {
        byId: Object.fromEntries(
          Object.entries(value.byId).map(([key, item]) => [
            key,
            read(item, `${origin}.byId.${key}`),
          ]),
        ),
        fallback: read(value.default, `${origin}.default`),
      };
    }
    return { byId: {}, fallback: read(value, origin) };
  }

  part(part: PartDocument, origin: string): PreparedPart {
    const when =
      part.when === undefined ? {} : { when: this.condition(part.when, `${origin}.when`) };
    const at = { ...when, origin };
    if ('text' in part)
      return { ...at, kind: 'text', text: this.template(part.text, `${origin}.text`) };
    if ('note' in part) {
      return {
        ...at,
        kind: 'note',
        tone: part.note.tone,
        text: this.template(part.note.text, `${origin}.note.text`),
      };
    }
    if ('details' in part) {
      return {
        ...at,
        kind: 'details',
        summary: this.template(part.details.summary, `${origin}.details.summary`),
        text: this.template(part.details.text, `${origin}.details.text`),
      };
    }
    if ('table' in part) return { ...at, ...this.table(part.table, `${origin}.table`) };
    if ('metrics' in part) return { ...at, kind: 'metrics', ids: this.ids(part.metrics, origin) };
    if ('projects' in part)
      return { ...at, kind: 'projects', ids: this.ids(part.projects, origin) };
    if ('timeline' in part) return { ...at, kind: 'timeline', ids: part.timeline };
    if ('skills' in part) return { ...at, kind: 'skills', ids: part.skills };
    if ('contactCard' in part) return { ...at, kind: 'contactCard' };
    return { ...at, kind: 'contactOnce' };
  }

  private ids(ids: IdList | { readonly from: string }, origin: string): IdList | Pipeline {
    return typeof ids === 'object' && 'from' in ids
      ? this.pipeline(ids.from, `${origin}.from`)
      : ids;
  }

  private table(
    table: Extract<PartDocument, { table: unknown }>['table'],
    origin: string,
  ): PreparedPart & { kind: 'table' } {
    const columns = table.columns.map((column, index) =>
      this.template(column, `${origin}.columns[${String(index)}]`),
    );
    const { rows } = table;
    const prepared = Array.isArray(rows)
      ? rows.map((row, index) =>
          row.map((cell, column) =>
            this.template(cell, `${origin}.rows[${String(index)}][${String(column)}]`),
          ),
        )
      : {
          each: this.pipeline(rows.each, `${origin}.rows.each`),
          cells: rows.cells.map((cell, index) =>
            this.template(cell, `${origin}.rows.cells[${String(index)}]`),
          ),
        };
    return {
      origin,
      kind: 'table',
      columns,
      rows: prepared,
      ...(table.caption === undefined
        ? {}
        : { caption: this.template(table.caption, `${origin}.caption`) }),
    };
  }

  parts(parts: readonly PartDocument[], origin: string): PreparedPart[] {
    return parts.map((part, index) => this.part(part, `${origin}[${String(index)}]`));
  }

  strings(
    strings: Readonly<Record<string, unknown>> | undefined,
    origin: string,
  ): Readonly<Record<string, Variant<StringValue>>> {
    return Object.fromEntries(
      Object.entries(strings ?? {}).map(([key, value]) => [
        key,
        this.variant(
          value as string | Readonly<Record<string, string>>,
          `${origin}.${key}`,
          (item, at) =>
            typeof item === 'string'
              ? this.template(item, at)
              : Object.fromEntries(
                  Object.entries(item).map(([entry, text]) => [
                    entry,
                    this.template(text, `${at}[${entry}]`),
                  ]),
                ),
        ),
      ]),
    );
  }

  answer(answerId: string, answer: AnswerDocument, document: string): PreparedAnswer {
    const origin = `${document}#${answerId}`;
    const grounded = answer.grounded ?? true;
    return {
      id: answerId,
      document,
      parts: this.parts(answer.parts, `${origin}.parts`),
      followUps: this.variant(answer.followUps, `${origin}.followUps`, (list, at) =>
        list.map((followUp, index) => this.template(followUp, `${at}[${String(index)}]`)),
      ),
      sources: answer.sources.map((source, index) =>
        this.source(source, `${origin}.sources[${String(index)}]`),
      ),
      ...(answer.related === undefined
        ? {}
        : { related: this.template(answer.related, `${origin}.related`) }),
      grounded:
        typeof grounded === 'boolean'
          ? grounded
          : {
              condition: this.condition(grounded, `${origin}.grounded`),
              origin: `${origin}.grounded`,
            },
      strings: this.strings(answer.strings, `${origin}.strings`),
      fallbackSkillGroups: answer.fallbackSkillGroups ?? [],
      ...(answer.factsDiffer === undefined ? {} : { factsDiffer: answer.factsDiffer }),
    };
  }

  private source(
    source: string | { readonly id: string; readonly when: string },
    origin: string,
  ): PreparedSource {
    if (typeof source === 'string') {
      if (SOURCE_SETS.has(source)) return { kind: 'set', set: source as SourceSet, origin };
      return { kind: 'id', id: this.template(source, origin) };
    }
    return {
      kind: 'id',
      id: this.template(source.id, `${origin}.id`),
      when: this.condition(source.when, `${origin}.when`),
    };
  }

  topic(topicId: TopicId, topic: TopicDocument): PreparedTopic {
    const origin = `topics.yaml#${topicId}`;
    return {
      id: topicId,
      label: this.template(topic.label, `${origin}.label`),
      intro: this.template(topic.intro, `${origin}.intro`),
      description: this.template(topic.description, `${origin}.description`),
      questions: topic.questions.map((question, index) => {
        const at = `${origin}.questions[${String(index)}]`;
        return {
          question: this.template(question.question, `${at}.question`),
          tag: this.template(question.tag, `${at}.tag`),
          ...(question.short === undefined
            ? {}
            : { short: this.template(question.short, `${at}.short`) }),
        };
      }),
      page: this.parts(topic.page, `${origin}.page`),
      ...(topic.factsDiffer === undefined ? {} : { factsDiffer: topic.factsDiffer }),
    };
  }

  vocabulary(document: z.infer<typeof vocabularyDocumentSchema>): Vocabulary {
    return Object.fromEntries(
      Object.entries(document).map(([intent, rules]) => [
        intent,
        rules.map((rule, index): Rule => [
          this.regex(
            rule.pattern,
            rule.flags ?? '',
            `vocabulary.yaml#${intent}[${String(index)}].pattern`,
          ),
          rule.weight,
        ]),
      ]),
    );
  }
}

function answersOf(
  preparation: Preparation,
  documents: CopyDocuments,
): Map<string, PreparedAnswer> {
  const answers = new Map<string, PreparedAnswer>();
  for (const [document, value] of Object.entries(documents)) {
    if (!ANSWER_DOCUMENT.test(document)) continue;
    const decoded = preparation.decode(document, answersDocumentSchema, value);
    for (const [answerId, answer] of Object.entries(decoded ?? {})) {
      const earlier = answers.get(answerId);
      if (earlier) {
        preparation.problems.push(
          `${document}#${answerId}: the answer is also written in ${earlier.document}`,
        );
        continue;
      }
      answers.set(answerId, preparation.answer(answerId, answer, document));
    }
  }
  return answers;
}

/** The answers the core always gives, each of which the copy must write. */
function fixedAnswersOf(
  preparation: Preparation,
  answers: ReadonlyMap<string, PreparedAnswer>,
): Readonly<Record<FixedAnswer, PreparedAnswer>> | null {
  const missing = FIXED_ANSWERS.filter((fixed) => !answers.has(fixed));
  for (const fixed of missing) {
    preparation.problems.push(`answers/: the copy needs a "${fixed}" answer`);
  }
  if (missing.length > 0) return null;
  return Object.fromEntries(FIXED_ANSWERS.map((fixed) => [fixed, answers.get(fixed)])) as Record<
    FixedAnswer,
    PreparedAnswer
  >;
}

function unexpectedDocuments(documents: CopyDocuments): string[] {
  return Object.keys(documents)
    .filter((document) => !SINGLE_DOCUMENTS.includes(document) && !ANSWER_DOCUMENT.test(document))
    .map((document) => `${document}: not a copy document (see copy-document.ts for the layout)`);
}

function required<T>(
  preparation: Preparation,
  documents: CopyDocuments,
  document: string,
  schema: z.ZodType<T>,
): T | null {
  if (!Object.hasOwn(documents, document)) {
    preparation.problems.push(`${document}: the copy needs this document`);
    return null;
  }
  return preparation.decode(document, schema, documents[document]);
}

function optional<T>(
  preparation: Preparation,
  documents: CopyDocuments,
  document: string,
  schema: z.ZodType<T>,
): T | null {
  if (!Object.hasOwn(documents, document)) return null;
  return preparation.decode(document, schema, documents[document]);
}

function extractionsOf(
  preparation: Preparation,
  facts: z.infer<typeof factsDocumentSchema> | null,
): Record<string, PreparedExtraction> {
  return Object.fromEntries(
    Object.entries(facts?.extract ?? {}).map(([extractName, extraction]) => {
      const origin = `facts.yaml#extract.${extractName}`;
      return [
        extractName,
        {
          origin,
          from: preparation.pipeline(extraction.from, `${origin}.from`),
          pattern: preparation.regex(extraction.pattern, '', `${origin}.pattern`),
          groups: extraction.groups,
        },
      ];
    }),
  );
}

function duplicateStrings(
  shared: Readonly<Record<string, unknown>>,
  answers: ReadonlyMap<string, PreparedAnswer>,
): string[] {
  return [...answers.values()].flatMap((answer) =>
    Object.keys(answer.strings)
      .filter((key) => Object.hasOwn(shared, key))
      .map(
        (key) =>
          `${answer.document}#${answer.id}.strings.${key}: facts.yaml already names a string "${key}"`,
      ),
  );
}

/** Parses one language's documents; throws a `CopyError` listing every problem. */
export function prepareLocaleCopy(documents: CopyDocuments, locale: Locale): PreparedCopy {
  const preparation = new Preparation(locale);
  preparation.problems.push(...unexpectedDocuments(documents));
  const answers = answersOf(preparation, documents);
  const fixed = fixedAnswersOf(preparation, answers);
  const topics = required(preparation, documents, 'topics.yaml', topicsDocumentSchema);
  const vocabulary = optional(preparation, documents, 'vocabulary.yaml', vocabularyDocumentSchema);
  const labels = required(preparation, documents, 'labels.yaml', labelsDocumentSchema);
  const facts = optional(preparation, documents, 'facts.yaml', factsDocumentSchema);
  const ui = optional(preparation, documents, 'ui.yaml', overridesDocumentSchema);
  const site = optional(preparation, documents, 'site.yaml', overridesDocumentSchema);
  const about = optional(preparation, documents, 'about.yaml', aboutDocumentSchema);
  const strings = preparation.strings(facts?.strings, 'facts.yaml#strings');
  const prepared = {
    locale,
    answers,
    topics: topics
      ? (Object.fromEntries(
          TOPIC_IDS.map((topicId) => [topicId, preparation.topic(topicId, topics[topicId])]),
        ) as Record<TopicId, PreparedTopic>)
      : null,
    vocabulary: preparation.vocabulary(vocabulary ?? {}),
    labels,
    extract: extractionsOf(preparation, facts),
    strings,
    ui: ui ?? {},
    site: site ?? {},
    ...(about
      ? {
          about: {
            label: preparation.template(about.label, 'about.yaml#label'),
            title: preparation.template(about.title, 'about.yaml#title'),
            description: preparation.template(about.description, 'about.yaml#description'),
            markdown: preparation.template(about.markdown, 'about.yaml#markdown'),
          },
        }
      : {}),
  };
  preparation.problems.push(...duplicateStrings(strings, answers));
  const { topics: preparedTopics, labels: preparedLabels } = prepared;
  if (preparation.problems.length > 0 || !fixed || !preparedTopics || !preparedLabels) {
    throw new CopyError(preparation.problems);
  }
  return { ...prepared, fixed, topics: preparedTopics, labels: preparedLabels };
}
