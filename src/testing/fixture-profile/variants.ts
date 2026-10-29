import type { AnswerSet } from '@/core/assistant/answer-set';
import type { ScoredIntent } from '@/core/assistant/system1/intents';
import type { KnowledgeSource, MetricSource, RoleSource } from '@/core/knowledge/schema';

/**
 * Builders for a fixture that differs in one known way, so a test can show
 * that an answer follows the record or the copy — not a value written in code.
 */

export function withRole(
  source: KnowledgeSource,
  id: string,
  patch: Partial<RoleSource>,
): KnowledgeSource {
  return {
    ...source,
    experience: source.experience.map((role) => (role.id === id ? { ...role, ...patch } : role)),
  };
}

export function withMetric(
  source: KnowledgeSource,
  id: string,
  patch: Partial<MetricSource>,
): KnowledgeSource {
  const metric = source.metrics[id];
  if (!metric) throw new Error(`The fixture has no metric "${id}".`);
  return { ...source, metrics: { ...source.metrics, [id]: { ...metric, ...patch } } };
}

export function withoutVocabulary(answers: AnswerSet, intent: ScoredIntent): AnswerSet {
  const { [intent]: _removed, ...vocabulary } = answers.vocabulary;
  return { ...answers, vocabulary };
}
