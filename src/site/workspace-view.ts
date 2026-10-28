import { MAX_QUESTION_LENGTH } from '@/core/chat/request';
import type { TopicId } from '@/core/chat/topic-id';
import { createConversation } from '@/core/conversation/conversation';
import type { Knowledge } from '@/core/knowledge/schema';
import { pagePath } from './routes';
import type { SiteContent } from './site-content';

const SUGGESTION_COUNT = 4;

/** What the chat workspace is rendered with, from the record. */
export function workspaceView(
  { locale, knowledge, topicCatalog, topicIntro, pages }: SiteContent,
  topic: TopicId = 'overview',
) {
  const { profile, contact, welcome, assistant } = knowledge;
  const { heading, description, placeholder, helper } = welcome;
  return {
    profile: { name: profile.name, title: profile.title, photoUrl: profile.photoUrl },
    links: contact,
    topics: topicCatalog.topics.map(({ id, label, icon }) => ({
      id,
      label,
      icon,
      href: pagePath(locale, id),
    })),
    pages,
    welcome: { heading, description, placeholder, helper, evidence: evidenceLine(knowledge) },
    assistant: { name: assistant.name, initials: assistant.initials },
    suggestions: topicCatalog
      .suggestedQuestions(topic, 0, SUGGESTION_COUNT)
      .map(({ question, short }) => ({ question, label: short })),
    seed: createConversation(topic, topicIntro(topic)),
    maxQuestionLength: MAX_QUESTION_LENGTH,
    topic,
  };
}

/** The companies and the two headline metrics the welcome screen backs its greeting with. */
export function evidenceLine(knowledge: Knowledge) {
  const { roles, metrics } = knowledge.welcome.evidence;
  return {
    companies: roles.map((id) => companyOf(knowledge, id)),
    metrics: metrics.map((id) => headlineMetric(knowledge, id)),
  };
}

// The record's validation resolves every id the evidence line names.
function companyOf({ experience }: Knowledge, roleId: string) {
  const role = experience.find(({ id }) => id === roleId);
  if (!role) throw new Error(`The evidence line names no role "${roleId}".`);
  return role.company;
}

function headlineMetric({ metrics }: Knowledge, metricId: string) {
  const metric = metrics[metricId];
  if (!metric) throw new Error(`The evidence line names no metric "${metricId}".`);
  return { value: metric.value, label: metric.label };
}
