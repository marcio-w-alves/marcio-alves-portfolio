import type { AnswerBuilder, Answers } from '@/core/assistant/answer-set';
import type { ScoredIntent } from '@/core/assistant/system1/intents';

/** The answer a copy gives an intent, for a test that knows the copy writes one. */
export function scoredAnswer(answers: Answers, intent: ScoredIntent): AnswerBuilder {
  const build = answers.scored[intent];
  if (!build) throw new Error(`The copy writes no "${intent}" answer.`);
  return build;
}
