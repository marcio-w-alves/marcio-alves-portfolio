import { createResponseKit, type ResponseKit } from '@/core/assistant/response-kit';
import { createTopicIntro, type TopicIntro } from '@/core/assistant/topic-pages';
import { createTopicCatalog, type TopicCatalog, type TopicId } from '@/core/assistant/topics';
import { localize } from '@/core/knowledge/localize';
import type { Knowledge, KnowledgeSource } from '@/core/knowledge/schema';

/** The record as the pages read it, with what they build from it. */
export interface SiteContent {
  readonly knowledge: Knowledge;
  readonly responseKit: ResponseKit;
  readonly topicCatalog: TopicCatalog;
  readonly topicIntro: (topic: TopicId) => TopicIntro;
}

export function createSiteContent(source: KnowledgeSource): SiteContent {
  const knowledge = localize(source, 'en');
  const responseKit = createResponseKit(knowledge);
  const topicCatalog = createTopicCatalog(responseKit);
  return {
    knowledge,
    responseKit,
    topicCatalog,
    topicIntro: createTopicIntro(responseKit, topicCatalog),
  };
}
