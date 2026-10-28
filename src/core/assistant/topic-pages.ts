import type { TopicId } from '../chat/topic-id';
import type { TopicIntro } from '../chat/topic-intro';
import { text } from './response-kit';
import type { TopicCatalog } from './topics';

const INTRO_FOLLOW_UPS = 3;

export function createTopicIntro(catalog: TopicCatalog) {
  return (topic: TopicId): TopicIntro => ({
    parts: [text(catalog.topicById(topic).intro), ...catalog.pageOf(topic)],
    followUps: catalog.suggestions(topic, 0, INTRO_FOLLOW_UPS),
  });
}
