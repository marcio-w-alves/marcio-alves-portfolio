import type { AnswerSource } from '../chat/events';

/** How an answer credits the knowledge-base record it was built from. */
export function createCitation(sourceLabels: Readonly<Record<string, string>>) {
  return (id: string): AnswerSource => {
    const label = sourceLabels[id];
    if (label === undefined) throw new Error(`Unknown source "${id}".`);
    return { id, label };
  };
}
