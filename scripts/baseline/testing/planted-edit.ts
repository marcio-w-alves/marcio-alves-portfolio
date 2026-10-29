import type { AnswerBuilder, AnswerSet, Answers } from '../../../src/core/assistant/answer-set';
import type { AssistantResponse } from '../../../src/core/assistant/response';

/**
 * The copy with one word changed in the answer to one question — the edit
 * the owner plants in M0.3 — so a comparison has exactly one thing to find.
 */
export function withEditedAnswer(set: AnswerSet, question: string, addition: string): AnswerSet {
  const edit =
    (build: AnswerBuilder): AnswerBuilder =>
    (context, asked) => {
      const response = build(context, asked);
      return asked === question ? editFirstText(response, addition) : response;
    };
  return {
    ...set,
    answers: (kit) => {
      const answers = set.answers(kit);
      const scored = Object.fromEntries(
        Object.entries(answers.scored).map(([intent, build]) => [intent, edit(build)]),
      ) as Answers['scored'];
      return { ...answers, scored };
    },
  };
}

function editFirstText(response: AssistantResponse, addition: string): AssistantResponse {
  const index = response.parts.findIndex((part) => part.type === 'text');
  return {
    ...response,
    parts: response.parts.map((part, at) =>
      at === index && part.type === 'text' ? { ...part, text: `${part.text} ${addition}` } : part,
    ),
  };
}
