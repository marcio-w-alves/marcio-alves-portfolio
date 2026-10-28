import type { ResponsePart } from './response';
import type { TopicId } from '../chat/topic-id';
import { text } from './response-kit';
import type { TopicCatalog } from './topics';

const INTRO_FOLLOW_UPS = 3;

/** How a topic's page opens: its introduction, its part of the record, and what to ask next. */
export interface TopicIntro {
  readonly parts: readonly ResponsePart[];
  readonly followUps: readonly string[];
}

export function createTopicIntro(catalog: TopicCatalog) {
  return (topic: TopicId): TopicIntro => ({
    parts: [text(catalog.topicById(topic).intro), ...catalog.pageOf(topic)],
    followUps: catalog.suggestions(topic, 0, INTRO_FOLLOW_UPS),
  });
}
