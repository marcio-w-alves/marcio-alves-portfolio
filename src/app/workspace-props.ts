import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import { topics } from '@/core/assistant/topics';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';

/** What the chat workspace is rendered with, from the record. */
export function workspaceProps() {
  const { profile, contact, welcome } = knowledgeBase;
  return {
    profile: { name: profile.name, title: profile.title },
    links: contact,
    topics: topics.map(({ id, label, icon }) => ({ id, label, icon })),
    welcome,
    maxQuestionLength: MAX_QUESTION_LENGTH,
  };
}
