import { ABOUT_PATH, type AboutPageCopy } from './about-page';
import type { AnswerSet } from '@/core/assistant/answer-set';
import { createResponseKit, type ResponseKit } from '@/core/assistant/response-kit';
import { createTopicIntro } from '@/core/assistant/topic-pages';
import { createTopicCatalog, type TopicCatalog } from '@/core/assistant/topics';
import type { TopicId } from '@/core/chat/topic-id';
import type { TopicIntro } from '@/core/chat/topic-intro';
import { localize } from '@/core/knowledge/localize';
import type { Knowledge, KnowledgeSource } from '@/core/knowledge/schema';

/** The record as the pages read it, with what they build from it. */
export interface SiteContent {
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
  about?: AboutPageCopy,
): SiteContent {
  const knowledge = localize(source, 'en');
  const responseKit = createResponseKit(knowledge);
  const topicCatalog = createTopicCatalog(answers.topics(responseKit));
  return {
    knowledge,
    responseKit,
    topicCatalog,
    topicIntro: createTopicIntro(topicCatalog),
    pages: about ? [{ label: about.label, icon: 'layers', href: ABOUT_PATH }] : [],
  };
}
