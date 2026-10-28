import { TOPIC_IDS, type TopicId } from '@/core/chat/topic-id';
import { interpolate, type Template } from '@/core/i18n/format';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/core/i18n/locale';
import { profile } from '@/profile';
import { publishedLocales } from '@/site/published-locales';
import { ABOUT_PAGE, pagePath, type SitePage } from '@/site/routes';
import { createSiteContent } from '@/site/site-content';
import { siteMessages } from '@/site/site-messages';
import { copyIn } from '@/site/site-profile';

/**
 * What the journeys expect to see, read from the profile the site is built
 * from — never written into a spec — so they pass for anyone's profile. Answer
 * content is checked against the record and the topic questions, never by
 * running the fast path here, which would make the code under test its own
 * oracle.
 */

/** The pages of one language: its record, its topics and its catalogs, as the site builds them. */
export function pagesIn(locale: Locale) {
  const copy = copyIn(profile, locale);
  const pages = createSiteContent(profile.knowledge, copy.answers, locale);
  return { ...pages, ...siteMessages(pages.knowledge, copy, locale) };
}

/** Every page of one language: each topic, and the page about the site where its copy writes one. */
export function pagePathsIn(locale: Locale): string[] {
  const pages: SitePage[] = copyIn(profile, locale).about
    ? [...TOPIC_IDS, ABOUT_PAGE]
    : [...TOPIC_IDS];
  return pages.map((page) => pagePath(locale, page));
}

/** Every message of a catalog by its path, e.g. `ui.errors.retryIn.one`; list items each count. */
function messagesByPath(catalog: unknown, path = ''): [string, string][] {
  if (typeof catalog === 'string') return [[path, catalog]];
  if (catalog === null || typeof catalog !== 'object') return [];
  return Object.entries(catalog).flatMap(([key, value]) =>
    messagesByPath(value, path ? `${path}.${key}` : key),
  );
}

/**
 * The interface's English messages that read differently in `locale` — what a
 * page in that language must never show. Templates the browser still fills
 * are left out: they never appear as written. So is each language's own name,
 * which the switcher shows in that language on every page.
 */
export function englishOnlyMessages(locale: Locale): string[] {
  const english = pagesIn(DEFAULT_LOCALE);
  const theirs = new Map(messagesByPath({ ui: pagesIn(locale).ui, site: pagesIn(locale).site }));
  return messagesByPath({ ui: english.ui, site: english.site })
    .filter(([path]) => !path.startsWith('ui.language.'))
    .filter(([path, message]) => theirs.get(path) !== message && !message.includes('{'))
    .map(([, message]) => message);
}

/** The languages the build under test serves: the profile's, plus a preview's (`PREVIEW_LOCALES`). */
export const published = publishedLocales(profile.locales, process.env);

/** The languages the site can speak but this build does not publish. */
export const unpublished = SUPPORTED_LOCALES.filter((locale) => !published.includes(locale));

const content = pagesIn('en');

/** The record, in English. */
export const record = content.knowledge;

/** The interface's catalog and the pages' copy, as the site renders them. */
export const { ui, site } = content;

export function topicLabel(topic: TopicId): string {
  return content.topicCatalog.topicById(topic).label;
}

/** The sentence a topic's page opens with. */
export function topicIntro(topic: TopicId): string {
  return content.topicCatalog.topicById(topic).intro;
}

/** Every question a topic offers, as asked. */
export function topicQuestions(topic: TopicId): string[] {
  return content.topicCatalog.topicById(topic).questions.map(({ question }) => question);
}

/** The questions a page's welcome or introduction offers, with the label each chip shows. */
export function suggestedQuestions(topic: TopicId) {
  return content.topicCatalog
    .suggestedQuestions(topic, 0, 4)
    .map(({ question, short }) => ({ question, label: short }));
}

/** The first question the home page suggests, which every journey that needs an answer asks. */
export function firstSuggestion() {
  const [first] = suggestedQuestions('overview');
  if (!first) throw new Error('The home page suggests no question.');
  return first;
}

/** How the conversation reads a visitor's question back to a screen reader. */
export function youAsked(question: string): string {
  return `${ui.conversation.youAsked} ${question}`;
}

/** The first thing the assistant says while it reads, as the page shows it. */
export function firstThinkingPhase(): string {
  return `${ui.conversation.thinking[0] ?? ''}…`;
}

/** A catalog template as a pattern, its placeholders matching any text. */
export function templatePattern(template: Template): RegExp {
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\{\w+\}/g, '(.+)')}$`);
}

/** A catalog template filled in. */
export function fill(template: Template, values: Readonly<Record<string, string>>): string {
  return interpolate(template, values);
}

export function roleByCompany(company: string) {
  const role = record.experience.find((candidate) => candidate.company === company);
  if (!role) throw new Error(`The record has no role at ${company}.`);
  return role;
}

/** The companies and headline metrics the record flags for the welcome screen, by id. */
export function welcomeEvidence() {
  const { roles, metrics } = record.welcome.evidence;
  return {
    companies: roles.map((id) => {
      const role = record.experience.find((candidate) => candidate.id === id);
      if (!role) throw new Error(`The record has no role "${id}".`);
      return role.company;
    }),
    metrics: metrics.map(metric),
  };
}

/** Where the record publishes the résumé. */
export function resumeUrl(): string {
  const url = record.contact.resumeUrl;
  if (!url) throw new Error('The record publishes no résumé.');
  return url;
}

export function metric(id: string) {
  const found = record.metrics[id];
  if (!found) throw new Error(`The record has no metric "${id}".`);
  return found;
}

/** A role's own sentence, from the first section the timeline shows for it. */
export function firstResponsibility(company: string): string {
  const [first] = roleByCompany(company).responsibilities;
  if (!first) throw new Error(`The record lists no responsibility at ${company}.`);
  return first;
}

/** Any of the labels the record cites its sources by, as a whole text. */
export function sourceLabelPattern(): RegExp {
  const labels = [...new Set(Object.values(record.sourceLabels))].map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(`^(${labels.join('|')})$`);
}
