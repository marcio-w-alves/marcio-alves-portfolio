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
}

export function createSiteContent(source: KnowledgeSource, answers: AnswerSet): SiteContent {
  const knowledge = localize(source, 'en');
  const responseKit = createResponseKit(knowledge);
  const topicCatalog = createTopicCatalog(answers.topics(responseKit));
  return {
    knowledge,
    responseKit,
    topicCatalog,
    topicIntro: createTopicIntro(topicCatalog),
  };
}
