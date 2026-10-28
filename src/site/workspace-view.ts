import { MAX_QUESTION_LENGTH } from '@/core/chat/request';
import type { TopicId } from '@/core/chat/topic-id';
import { createConversation } from '@/core/conversation/conversation';
import { topicPath } from './routes';
import type { SiteContent } from './site-content';

const SUGGESTION_COUNT = 4;

/** What the chat workspace is rendered with, from the record. */
export function workspaceView(
  { knowledge, topicCatalog, topicIntro }: SiteContent,
  topic: TopicId = 'overview',
) {
  const { profile, contact, welcome, assistant } = knowledge;
  return {
    profile: { name: profile.name, title: profile.title },
    links: contact,
    topics: topicCatalog.topics.map(({ id, label, icon }) => ({
      id,
      label,
      icon,
      href: topicPath(id),
    })),
    welcome,
    assistant: { name: assistant.name, initials: assistant.initials },
    suggestions: topicCatalog
      .suggestedQuestions(topic, 0, SUGGESTION_COUNT)
      .map(({ question, short }) => ({ question, label: short })),
    seed: createConversation(topic, topicIntro(topic)),
    maxQuestionLength: MAX_QUESTION_LENGTH,
    topic,
  };
}
