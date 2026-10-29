import type { AnswerSet } from '@/core/assistant/answer-set';
import { createResponseKit, type ResponseKit } from '@/core/assistant/response-kit';
import { createTopicIntro } from '@/core/assistant/topic-pages';
import { createTopicCatalog, type TopicCatalog } from '@/core/assistant/topics';
import type { TopicId } from '@/core/chat/topic-id';
import type { TopicIntro } from '@/core/chat/topic-intro';
import type { Locale } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import type { Knowledge, KnowledgeSource } from '@/core/knowledge/schema';
import type { AboutPageCopy } from './about-page';
import { ABOUT_PAGE, pagePath } from './routes';

/** The record as the pages of one language read it, with what they build from it. */
export interface SiteContent {
  readonly locale: Locale;
  readonly knowledge: Knowledge;
  readonly responseKit: ResponseKit;
  readonly topicCatalog: TopicCatalog;
  readonly topicIntro: (topic: TopicId) => TopicIntro;
  /** The pages beside the topics, as the sidebar links them. */
  readonly pages: readonly {
    readonly label: string;
    readonly icon: 'layers';
    readonly href: string;
  }[];
}

export function createSiteContent(
  source: KnowledgeSource,
  answers: AnswerSet,
  locale: Locale,
  about?: AboutPageCopy,
): SiteContent {
  const knowledge = localize(source, locale);
  const responseKit = createResponseKit(knowledge, answers.labels);
  const topicCatalog = createTopicCatalog(answers.topics(responseKit));
  return {
    locale,
    knowledge,
    responseKit,
    topicCatalog,
    topicIntro: createTopicIntro(topicCatalog),
    pages: about
      ? [{ label: about.label, icon: 'layers', href: pagePath(locale, ABOUT_PAGE) }]
      : [],
  };
}
