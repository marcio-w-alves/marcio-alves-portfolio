import type { TopicId } from '@/core/chat/topic-id';

/** Each topic's page: the overview is the home page, the rest live under their id. */
export function topicPath(topic: TopicId): string {
  return topic === 'overview' ? '/' : `/${topic}`;
}
