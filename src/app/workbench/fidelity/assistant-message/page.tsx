import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { toEvents } from '@/core/assistant/response';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import {
  addExchange,
  applyEvent,
  contextOf,
  createConversation,
} from '@/core/conversation/conversation';
import type { AssistantMessage } from '@/core/conversation/messages';
import { knowledge } from '../../../site-knowledge';
import { AssistantMessageSpecimen } from './assistant-message-specimen';

// The design's AssistantMessage artboard: the answer the fast path gives to
// one question, replayed through the conversation as it streams, on its own.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

const QUESTION = 'How does he approach frontend architecture?';

function answerTo(question: string): AssistantMessage {
  const { conversation, answerId } = addExchange(createConversation(), question);
  const result = createFastPath(knowledge).answer(question, contextOf(conversation));
  if (result.kind !== 'answered') throw new Error(`The fast path no longer answers "${question}".`);
  const answered = toEvents(result.response).reduce(
    (next, event) => applyEvent(next, answerId, event),
    conversation,
  );
  const answer = answered.messages.at(-1);
  if (answer?.role !== 'assistant') throw new Error('The exchange has no answer.');
  return answer;
}

export default function AssistantMessageFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const message = answerTo(QUESTION);
  const company = knowledge.experience.find((role) => role.id === message.related)?.company;
  return (
    <div className="min-h-screen p-10">
      <AssistantMessageSpecimen
        message={message}
        assistantName={knowledge.assistant.name}
        relatedLabel={company ? `View ${company} experience` : undefined}
      />
    </div>
  );
}
