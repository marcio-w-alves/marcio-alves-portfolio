import { createHash } from 'node:crypto';
import { createResponseKit } from '../../src/core/assistant/response-kit';
import { createFastPath, type FastPath } from '../../src/core/assistant/system1/fast-path';
import { ROUTED_TECHNOLOGIES } from '../../src/core/assistant/system1/technologies';
import type { AssistantResponse } from '../../src/core/assistant/response';
import { TOPIC_IDS, type TopicId } from '../../src/core/chat/topic-id';
import type { ConversationContext } from '../../src/core/chat/request';
import { DEFAULT_LOCALE, mapTranslations, type Locale } from '../../src/core/i18n/locale';
import { localize } from '../../src/core/knowledge/localize';
import type { Profile } from '../../src/profile/schema';
import { SHARE_IMAGE } from '../../src/site/metadata';
import { publishedLocales } from '../../src/site/published-locales';
import { ABOUT_PAGE, assetPath, pagePath, type SitePage } from '../../src/site/routes';
import { copyIn } from '../../src/site/site-profile';
import {
  INPUTS_FORMAT,
  type AnswerInput,
  type AnswerOrigin,
  type BaselineInputs,
  type PageInput,
  type RouteInput,
} from './inputs';

/**
 * Everything the site and its router define, read from the profile of the
 * checkout this runs in: the pages of every published language, the metadata
 * routes, the record's files, and every question the fast path answers — the
 * topics' questions, the follow-ups those answers offer (and theirs, until no
 * new one appears), a probe per company, project and routed technology, and
 * the evaluation's questions. A question the router escalates is left out: its
 * answer is the model's, which a baseline cannot hold still.
 */

export type EnumeratedProfile = Pick<
  Profile,
  'locales' | 'knowledge' | 'copy' | 'brand' | 'evaluation'
>;

/** A path no page has, for the not-found page each language writes. */
const MISSING_PAGE = 'baseline-missing-page';

const METADATA_ROUTES: readonly RouteInput[] = [
  { id: '/sitemap.xml', path: '/sitemap.xml', kind: 'sitemap' },
  { id: '/robots.txt', path: '/robots.txt', kind: 'text' },
  { id: '/icon', path: '/icon', kind: 'image' },
  { id: '/apple-icon', path: '/apple-icon', kind: 'image' },
];

const OVERVIEW: ConversationContext = { topic: 'overview', lastIntent: null, ctaShown: false };

export function enumerateInputs(
  profile: EnumeratedProfile,
  retrievalProbes: readonly string[],
): BaselineInputs {
  const locales = publishedLocales(profile.locales, {});
  return {
    format: INPUTS_FORMAT,
    locales,
    pages: locales.flatMap((locale) => pagesOf(profile, locale)),
    routes: [...METADATA_ROUTES, ...shareImages(locales), ...recordAssets(profile)],
    answers: fastPathQuestions(profile, locales),
    retrievalProbes,
  };
}

function pagesOf(profile: EnumeratedProfile, locale: Locale): PageInput[] {
  const pages: SitePage[] = copyIn(profile, locale).about
    ? [...TOPIC_IDS, ABOUT_PAGE]
    : [...TOPIC_IDS];
  const home = pagePath(locale, 'overview');
  const missing = `${home === '/' ? '' : home}/${MISSING_PAGE}`;
  return [
    ...pages.map((page) => ({ id: `${locale}/${page}`, locale, path: pagePath(locale, page) })),
    { id: `${locale}/not-found`, locale, path: missing },
  ];
}

function shareImages(locales: readonly Locale[]): RouteInput[] {
  return locales.map((locale) => {
    const path = assetPath(locale, SHARE_IMAGE);
    return { id: path, path, kind: 'image' };
  });
}

/** The files the record links on this site, such as the résumé and the photo. */
function recordAssets({ knowledge }: EnumeratedProfile): RouteInput[] {
  const { profile, contact } = localize(knowledge, DEFAULT_LOCALE);
  return [profile.photoUrl, contact.resumeUrl]
    .filter((url): url is string => typeof url === 'string' && url.startsWith('/'))
    .map((path) => ({ id: path, path, kind: 'asset' }));
}

interface Asked {
  readonly origin: AnswerOrigin;
  readonly locale: Locale;
  readonly message: string;
  readonly context: ConversationContext;
}

function fastPathQuestions(profile: EnumeratedProfile, locales: readonly Locale[]): AnswerInput[] {
  const fastPath = buildFastPath(profile);
  const found = new Map<string, AnswerInput>();
  const pending: Asked[] = [
    ...locales.flatMap((locale) => topicQuestions(profile, locale)),
    ...locales.flatMap((locale) => entityProbes(profile, locale)),
    ...evaluationQuestions(profile, locales),
  ];
  for (let asked = pending.shift(); asked; asked = pending.shift()) {
    const key = questionOnPage(asked);
    if (found.has(key)) continue;
    const response = answeredByFastPath(fastPath, asked);
    if (!response) continue;
    found.set(key, { id: answerId(asked), ...asked });
    pending.push(...followUpsOf(asked, response));
  }
  return [...found.values()];
}

/**
 * Each question once per page and language, in the context a visitor first
 * reaches it: asking it again after every other answer would multiply the
 * baseline by the number of intents, for answers that differ only in their
 * follow-ups.
 */
function questionOnPage({ locale, context, message }: Asked): string {
  return JSON.stringify([locale, context.topic, message]);
}

/** The fast path exactly as the site's composition root builds it. */
function buildFastPath({ knowledge, copy }: EnumeratedProfile): FastPath {
  return createFastPath(
    mapTranslations(copy, ({ answers }, locale) => ({
      knowledge: localize(knowledge, locale),
      answers,
    })),
  );
}

function answeredByFastPath(fastPath: FastPath, asked: Asked): AssistantResponse | null {
  const result = fastPath.answer(asked.message, asked.context, asked.locale);
  return result.kind === 'answered' ? result.response : null;
}

function topicQuestions(profile: EnumeratedProfile, locale: Locale): Asked[] {
  const { answers } = copyIn(profile, locale);
  const topics = answers.topics(
    createResponseKit(localize(profile.knowledge, locale), answers.labels),
  );
  return TOPIC_IDS.flatMap((topic: TopicId) =>
    topics[topic].questions.map(({ question }) => ({
      origin: 'topic' as const,
      locale,
      message: question,
      context: { topic, lastIntent: null, ctaShown: false },
    })),
  );
}

/** The question a visitor asks next, in the context the conversation then carries. */
function followUpsOf(asked: Asked, response: AssistantResponse): Asked[] {
  const showedContact = response.parts.some(
    (part) => part.type === 'component' && part.component === 'contact',
  );
  const context: ConversationContext = {
    topic: asked.context.topic,
    lastIntent: response.intent,
    ctaShown: asked.context.ctaShown || showedContact,
  };
  return response.followUps.map((message) => ({
    origin: 'follow-up',
    locale: asked.locale,
    message,
    context,
  }));
}

/** A visitor typing just a company's, a project's or a technology's name. */
function entityProbes(profile: EnumeratedProfile, locale: Locale): Asked[] {
  const knowledge = localize(profile.knowledge, locale);
  const names = [
    ...knowledge.experience.flatMap((role) => [role.company, ...(role.aliases ?? [])]),
    ...knowledge.projects.map((project) => project.name),
    ...ROUTED_TECHNOLOGIES.map((technology) => technology.name),
  ];
  return names.map((message) => ({ origin: 'entity', locale, message, context: OVERVIEW }));
}

function evaluationQuestions(
  { evaluation }: EnumeratedProfile,
  locales: readonly Locale[],
): Asked[] {
  return evaluation
    .map((testCase) => ({ ...testCase, locale: testCase.pageLocale ?? DEFAULT_LOCALE }))
    .filter(({ locale }) => locales.includes(locale))
    .map(({ question, locale }) => ({
      origin: 'evaluation',
      locale,
      message: question,
      context: OVERVIEW,
    }));
}

/** Readable where it matters (language, page, what was asked before), unique by the question's hash. */
function answerId({ locale, message, context }: Omit<Asked, 'origin'>): string {
  const question = createHash('sha256').update(message).digest('hex').slice(0, 12);
  const before = context.lastIntent ?? '-';
  return `${locale}/${context.topic}/${before}/${context.ctaShown ? 'cta' : '-'}/${question}`;
}
