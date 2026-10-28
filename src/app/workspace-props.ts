import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import type { TopicId } from '@/core/assistant/topics';
import { createConversation } from '@/core/conversation/conversation';
import { knowledge, topicCatalog, topicIntro } from './site-knowledge';
import { topicPath } from './topic-routes';

const SUGGESTION_COUNT = 4;

/** What the chat workspace is rendered with, from the record. */
export function workspaceProps(topic: TopicId = 'overview') {
  const { profile, contact, welcome, assistant, experience } = knowledge;
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
    assistantName: assistant.name,
    companies: Object.fromEntries(experience.map((role) => [role.id, role.company])),
    suggestions: topicCatalog.suggestedQuestions(topic, 0, SUGGESTION_COUNT),
    seed: createConversation(topic, topicIntro(topic)),
    maxQuestionLength: MAX_QUESTION_LENGTH,
    topic,
  };
}
