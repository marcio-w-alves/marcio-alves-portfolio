'use client';

import { SuggestedQuestions, type QuestionChoice } from '@/ui/welcome';

/** On its own artboard a pick goes nowhere, as in the design. */
export function SuggestionsSpecimen({
  questions,
}: {
  readonly questions: readonly QuestionChoice[];
}) {
  return (
    <SuggestedQuestions
      title="Suggested questions"
      questions={questions}
      onPick={() => undefined}
    />
  );
}
