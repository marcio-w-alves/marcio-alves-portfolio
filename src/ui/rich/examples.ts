import type { RichComponent, RichComponentName } from '@/core/chat/components';
import type { ComponentPart } from '@/core/assistant/response';
import type { ConversationContext } from '@/core/chat/request';
import type { FastPath } from '@/core/assistant/system1/fast-path';

/**
 * Real blocks, exactly as the fast path sends them, for the tests: one
 * question per kind whose answer contains that kind.
 */
const QUESTION_FOR: Readonly<Record<RichComponentName, string>> = {
  metrics: "Tell me about Marcio's career.",
  timeline: "Tell me about Marcio's career.",
  skills: 'What are his strongest technical skills?',
  projects: 'What projects is he working on?',
  table: 'What makes Marcio a strong Staff Engineer?',
  note: 'How does he approach frontend architecture?',
  details: 'What has he built at Deel?',
  contact: 'How can I contact Marcio?',
};

type BlockOf<Name extends RichComponentName> = Extract<RichComponent, { component: Name }>;

const FIRST_VISIT: ConversationContext = { topic: 'overview', lastIntent: null, ctaShown: false };

export function exampleBlocks(fastPath: FastPath) {
  return <Name extends RichComponentName>(name: Name): BlockOf<Name> => {
    const result = fastPath.answer(QUESTION_FOR[name], FIRST_VISIT);
    const parts = result.kind === 'answered' ? result.response.parts : [];
    const block = parts.find(
      (part): part is ComponentPart & BlockOf<Name> =>
        part.type === 'component' && part.component === name,
    );
    if (!block) throw new Error(`The fast path no longer answers with a ${name} block.`);
    return block;
  };
}
