import type { ResponsePart } from '../../chat/components';
import type { ConversationContext } from '../../chat/request';
import { TOPIC_IDS, type TopicId } from '../../chat/topic-id';
import type { Locale } from '../../i18n/locale';
import type { SiteSubject } from '@/core/knowledge/schema';
import type { AnswerBuilder, AnswerSet, Answers } from '../answer-set';
import type { AssistantResponse } from '../response';
import { details, text, type ResponseKit } from '../response-kit';
import { SCORED_INTENTS, type ScoredIntent } from '../system1/intents';
import type { TechnologyEvidence } from '../system1/technologies';
import type { TopicCopy } from '../topics';
import type { CatalogOverrides, CopyDocuments } from './copy-document';
import {
  CopyError,
  prepareLocaleCopy,
  type IdList,
  type PreparedAnswer,
  type PreparedCopy,
  type PreparedExtraction,
  type PreparedPart,
  type PreparedTopic,
  type StringValue,
  type Variant,
} from './prepare';
import { Lazy, holds, renderTemplate, valueOf, type Mode, type Scope } from './render';
import { recordRoots, roleFactsOf, subjectRoot } from './scope';
import { TemplateError, type Pipeline, type Template } from './template';

/**
 * Turns one language's copy documents into what the fast path and the pages
 * consume: the same `AnswerSet` a profile once wrote in TypeScript, plus the
 * interface overrides and the about page. The words are the profile's; which
 * answer binds which parameters, how an undocumented technology is cited and
 * what a slowed-down visitor is offered are the core's.
 */

export interface AboutCopy {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
}

/** One language's compiled copy. */
export interface LocaleCopy {
  readonly answers: AnswerSet;
  readonly ui: CatalogOverrides;
  readonly site: CatalogOverrides;
  readonly about?: AboutCopy;
}

export interface CompileOptions {
  readonly locale: Locale;
  /** The assistant's limits the about page states: `{{limits.maxRounds}}`. */
  readonly limits: Readonly<Record<string, number>>;
  /** What the about page may say of the site: `{{identity.sourceRepository}}`. */
  readonly identity: Readonly<Record<string, string>>;
}

/** The language a question names, by each language's own notion of a word's edges. */
const ASKED_LANGUAGE: Readonly<Record<Locale, (name: string) => RegExp>> = {
  en: (name) => new RegExp(`\\b${escaped(name)}\\b`, 'i'),
  // \b only knows ASCII letters, and Portuguese language names end in ê or ã.
  'pt-BR': (name) => new RegExp(`(?<!\\p{L})${escaped(name)}(?!\\p{L})`, 'iu'),
};

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const START = { line: 1, column: 1 };

/** What an answer is rendered with besides the record. */
export interface Call {
  readonly intent: string;
  readonly params?: Readonly<Record<string, unknown>>;
  /** The id `byId` fields are chosen by. */
  readonly subjectId?: string;
  readonly site?: SiteSubject;
  readonly evidence?: readonly TechnologyEvidence[];
  readonly context?: ConversationContext;
  readonly givenFollowUps?: readonly string[];
}

/** A prepared copy bound to one record, through the kit that reads it. */
export class BoundCopy {
  private readonly base: Readonly<Record<string, unknown>>;

  constructor(
    readonly copy: PreparedCopy,
    readonly kit: ResponseKit,
    readonly mode: Mode = 'render',
  ) {
    const names = recordRoots(kit.knowledge);
    this.base = { ...names, extract: this.extractions(names) };
  }

  private extractions(names: Readonly<Record<string, unknown>>) {
    return Object.fromEntries(
      Object.entries(this.copy.extract).map(([extractName, extraction]) => [
        extractName,
        new Lazy((mode) => this.extract(extraction, { locale: this.copy.locale, mode, names })),
      ]),
    );
  }

  private extract(extraction: PreparedExtraction, scope: Scope): unknown {
    const value = valueOf(extraction.from, extraction.origin, scope);
    // Checking proves the path; how often the pattern matches is proven by rendering.
    if (scope.mode === 'check') return null;
    const texts = (Array.isArray(value) ? value : [value]).filter(
      (item): item is string => typeof item === 'string',
    );
    const matches = texts.flatMap((item) => {
      const match = extraction.pattern.exec(item);
      return match ? [match] : [];
    });
    const [match] = matches;
    if (matches.length !== 1 || !match) {
      throw new TemplateError(
        extraction.origin,
        START,
        `The pattern matches ${String(matches.length)} times in the record; it must match exactly once`,
      );
    }
    return Object.fromEntries(
      extraction.groups.map((group, index) => [group, match[index + 1] ?? '']),
    );
  }

  scopeFor(answer: PreparedAnswer | null, call: Call): Scope {
    const withoutStrings = { ...this.base, ...call.params };
    const stringsScope: Scope = {
      locale: this.copy.locale,
      mode: this.mode,
      names: withoutStrings,
    };
    const strings = Object.fromEntries(
      Object.entries({ ...this.copy.strings, ...answer?.strings }).map(([key, variant]) => [
        key,
        lazyString(pick(variant, call.subjectId), stringsScope),
      ]),
    );
    return { locale: this.copy.locale, mode: this.mode, names: { ...withoutStrings, strings } };
  }

  render(template: Template, scope: Scope, current?: unknown): string {
    return renderTemplate(template, scope, current === undefined ? undefined : { value: current });
  }

  respond(answer: PreparedAnswer, call: Call): AssistantResponse {
    const scope = this.scopeFor(answer, call);
    const parts = answer.parts.map((part) => this.part(part, scope, call.context));
    const given = call.givenFollowUps ?? [];
    const followUps =
      given.length > 0
        ? given
        : pick(answer.followUps, call.subjectId).map((followUp) => this.render(followUp, scope));
    const related = answer.related ? this.render(answer.related, scope) : '';
    const grounded =
      typeof answer.grounded === 'boolean'
        ? answer.grounded
        : holds(answer.grounded.condition, answer.grounded.origin, scope);
    return this.kit.response(call.intent, parts, {
      followUps,
      sources: this.sources(answer, scope, call),
      ...(related ? { related } : {}),
      grounded,
    });
  }

  private sources(answer: PreparedAnswer, scope: Scope, call: Call): string[] {
    return answer.sources.flatMap((source) => {
      if (source.kind === 'id') {
        if (source.when && !holds(source.when, source.id.origin, scope)) return [];
        return [this.render(source.id, scope)];
      }
      if (source.set === '$roles') return this.kit.allRoleSources();
      if (source.set === '$sites' && call.site) return this.kit.siteSources(call.site);
      if (source.set === '$evidence' && call.evidence) {
        return evidenceSources(call.evidence, this.fallbackSources(answer));
      }
      throw new TemplateError(source.origin, START, `${source.set} has no meaning in this answer`);
    });
  }

  private fallbackSources(answer: PreparedAnswer): string[] {
    return this.kit.knowledge.skills
      .filter((group) => answer.fallbackSkillGroups.includes(group.id))
      .map((group) => group.source);
  }

  part(part: PreparedPart, scope: Scope, context?: ConversationContext): ResponsePart | null {
    if (part.when && !holds(part.when, part.origin, scope)) return null;
    const { kit } = this;
    switch (part.kind) {
      case 'text':
        return text(this.render(part.text, scope));
      case 'note':
        return kit.note(part.tone, this.render(part.text, scope));
      case 'details':
        return details(this.render(part.summary, scope), this.render(part.text, scope));
      case 'table':
        return kit.table(
          part.columns.map((column) => this.render(column, scope)),
          this.rows(part, scope),
          part.caption ? this.render(part.caption, scope) : undefined,
        );
      case 'metrics':
        return kit.metrics(
          this.ids(part.ids, part.origin, scope) ?? Object.keys(kit.knowledge.metrics),
        );
      case 'projects':
        return kit.projects(this.ids(part.ids, part.origin, scope));
      case 'timeline':
        return kit.timeline(listed(part.ids));
      case 'skills':
        return kit.skills(listed(part.ids));
      case 'contactCard':
        return kit.contactCard();
      case 'contactOnce':
        if (!context) {
          throw new TemplateError(part.origin, START, 'contactOnce needs a conversation');
        }
        return kit.contactOnce(context);
    }
  }

  private rows(part: PreparedPart & { kind: 'table' }, scope: Scope): string[][] {
    const { rows } = part;
    if (isRowList(rows)) {
      return rows.map((row) => row.map((cell) => this.render(cell, scope)));
    }
    const { each, cells } = rows;
    const items = valueOf(each, `${part.origin}.rows.each`, scope);
    if (!Array.isArray(items)) {
      throw new TemplateError(`${part.origin}.rows.each`, START, 'The rows must be a list');
    }
    return items.map((item: unknown) => cells.map((cell) => this.render(cell, scope, item)));
  }

  /** Undefined means every item of the record. */
  private ids(ids: IdList | Pipeline, origin: string, scope: Scope): readonly string[] | undefined {
    if (ids === 'all') return undefined;
    if (Array.isArray(ids)) return ids as readonly string[];
    const value = valueOf(ids as Pipeline, `${origin}.from`, scope);
    if (typeof value === 'string') return [value];
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
    throw new TemplateError(`${origin}.from`, START, 'Must name an id or a list of ids');
  }

  topic(topic: PreparedTopic): TopicCopy {
    const scope = this.scopeFor(null, { intent: topic.id });
    return {
      label: this.render(topic.label, scope),
      intro: this.render(topic.intro, scope),
      description: this.render(topic.description, scope),
      questions: topic.questions.map(({ question, tag, short }) => ({
        question: this.render(question, scope),
        tag: this.render(tag, scope),
        ...(short ? { short: this.render(short, scope) } : {}),
      })),
      page: topic.page
        .map((part) => this.part(part, scope))
        .filter((part): part is ResponsePart => part !== null),
    };
  }

  answers(): Answers {
    const { fixed } = this.copy;
    return {
      scored: this.scored(),
      greeting: () => this.respond(fixed.greeting, { intent: 'greeting' }),
      privateInfo: () => this.respond(fixed.privateInfo, { intent: 'privateInfo' }),
      offPurpose: () => this.respond(fixed.offPurpose, { intent: 'offPurpose' }),
      unknown: () => this.respond(fixed.unknown, { intent: 'unknown' }),
      slowDown: (followUps) =>
        this.respond(fixed.slowDown, { intent: 'rateLimited', givenFollowUps: followUps }),
      company: (roleId) => this.respond(fixed.company, this.companyCall(roleId)),
      project: (projectId) => this.respond(fixed.project, this.projectCall(projectId)),
      technology: (evidence) => this.respond(fixed.technology, technologyCall(evidence)),
    };
  }

  projectCall(projectId: string): Call {
    return {
      intent: `project:${projectId}`,
      subjectId: projectId,
      site: { kind: 'project', id: projectId },
      params: {
        project: subjectRoot(
          this.kit.projectById(projectId),
          this.base.project as Readonly<Record<string, unknown>>,
        ),
        others: this.kit.knowledge.projects.filter((other) => other.id !== projectId),
      },
    };
  }

  /** The parameters of a scored intent's answer; only `languages` reads the question. */
  scoredCall(intent: ScoredIntent, context: ConversationContext, question: string): Call {
    return {
      intent,
      context,
      params: intent === 'languages' ? { asked: this.askedLanguage(question) } : {},
    };
  }

  companyCall(roleId: string): Call {
    return {
      intent: `company:${roleId}`,
      subjectId: roleId,
      site: { kind: 'company', id: roleId },
      params: {
        role: subjectRoot(
          roleFactsOf(this.kit.knowledge, roleId),
          this.base.role as Readonly<Record<string, unknown>>,
        ),
      },
    };
  }

  private scored(): Answers['scored'] {
    const builders: Partial<Record<ScoredIntent, AnswerBuilder>> = {};
    for (const intent of SCORED_INTENTS) {
      const answer = this.copy.answers.get(intent);
      if (!answer) continue;
      builders[intent] = (context, question) =>
        this.respond(answer, this.scoredCall(intent, context, question));
    }
    return builders;
  }

  /** The language a question names, if any: computed here, so no template ever sees the question. */
  askedLanguage(question: string): unknown {
    const pattern = ASKED_LANGUAGE[this.copy.locale];
    return (
      this.kit.knowledge.languages.find((language) => pattern(language.name).test(question)) ?? null
    );
  }
}

/** The parameters of an answer about technologies, which reads only where each appears. */
export function technologyCall(evidence: readonly TechnologyEvidence[]): Call {
  return {
    intent: 'technology',
    evidence,
    params: {
      documented: isDocumented(evidence),
      evidence: evidence.map(({ technology, work, skills, coursework }) => ({
        technology: { name: technology.name },
        work,
        skills,
        coursework,
      })),
    },
  };
}

function isDocumented(evidence: readonly TechnologyEvidence[]): boolean {
  return evidence.some((item) => item.work.length > 0 || item.skills.length > 0);
}

/**
 * Where each technology appears, credited without upgrading one kind of
 * evidence into another; an answer with nothing documented also cites the
 * skill groups it shows instead.
 */
function evidenceSources(
  evidence: readonly TechnologyEvidence[],
  fallback: readonly string[],
): string[] {
  const documented = isDocumented(evidence);
  return [
    ...new Set(
      evidence.flatMap((item) => [
        ...item.sources.work,
        ...item.sources.skills,
        ...(documented ? [] : fallback),
        ...item.sources.coursework,
      ]),
    ),
  ];
}

type Rows = (PreparedPart & { kind: 'table' })['rows'];

function isRowList(rows: Rows): rows is readonly (readonly Template[])[] {
  return Array.isArray(rows);
}

function listed(ids: IdList): readonly string[] | undefined {
  return ids === 'all' ? undefined : ids;
}

export function pick<T>(variant: Variant<T>, subjectId: string | undefined): T {
  return subjectId !== undefined && Object.hasOwn(variant.byId, subjectId)
    ? (variant.byId[subjectId] as T)
    : variant.fallback;
}

function lazyString(value: StringValue, scope: Scope): unknown {
  if (isTemplate(value)) return new Lazy((mode) => renderTemplate(value, { ...scope, mode }));
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      new Lazy((mode) => renderTemplate(entry, { ...scope, mode })),
    ]),
  );
}

export function isTemplate(value: StringValue): value is Template {
  return 'nodes' in value && 'origin' in value && Array.isArray(value.nodes);
}

function topicsOf(copy: PreparedCopy, kit: ResponseKit): Readonly<Record<TopicId, TopicCopy>> {
  const bound = new BoundCopy(copy, kit);
  return Object.fromEntries(
    TOPIC_IDS.map((topicId) => [topicId, bound.topic(copy.topics[topicId])]),
  ) as Record<TopicId, TopicCopy>;
}

export function aboutOf(copy: PreparedCopy, options: CompileOptions): AboutCopy | undefined {
  if (!copy.about) return undefined;
  const scope: Scope = {
    locale: options.locale,
    mode: 'render',
    names: { limits: options.limits, identity: options.identity },
  };
  const { label, title, description, markdown } = copy.about;
  return {
    label: renderTemplate(label, scope),
    title: renderTemplate(title, scope),
    description: renderTemplate(description, scope),
    markdown: renderTemplate(markdown, scope),
  };
}

/** A prepared copy as the `AnswerSet` the fast path and the pages consume. */
export function answerSetOf(copy: PreparedCopy): AnswerSet {
  return {
    vocabulary: copy.vocabulary,
    labels: copy.labels,
    topics: (kit) => topicsOf(copy, kit),
    answers: (kit) => new BoundCopy(copy, kit).answers(),
  };
}

/**
 * Compiles one language's copy documents. Throws a `CopyError` listing every
 * malformed document and every template that does not parse.
 */
export function compileLocaleCopy(documents: CopyDocuments, options: CompileOptions): LocaleCopy {
  const copy = prepareLocaleCopy(documents, options.locale);
  let about: AboutCopy | undefined;
  try {
    about = aboutOf(copy, options);
  } catch (error) {
    if (error instanceof TemplateError) throw new CopyError([error.message]);
    throw error;
  }
  return {
    answers: answerSetOf(copy),
    ui: copy.ui,
    site: copy.site,
    ...(about ? { about } : {}),
  };
}
