import type { AssistantEvent } from '@/core/assistant/assistant-event';
import { toEvents } from '@/core/assistant/response';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import {
  addExchange,
  applyEvent,
  contextOf,
  createConversation,
} from '@/core/conversation/conversation';
import type { Conversation } from '@/core/conversation/messages';
import { knowledge, topicIntro } from '../../../site-knowledge';

/**
 * The design's state boards, rebuilt the way its prototype builds them:
 * real fast-path events replayed through the conversation's transitions,
 * optionally frozen mid-answer.
 */

interface Partial {
  /** The last part streamed, by index; later parts and the finish never arrive. */
  readonly stopAtPart: number;
  /** How much of that part's text has arrived. */
  readonly ratio: number;
}

const fastPath = createFastPath(knowledge);

function eventsFor(question: string, conversation: Conversation): AssistantEvent[] {
  const result = fastPath.answer(question, contextOf(conversation));
  if (result.kind !== 'answered') throw new Error(`"${question}" is not a fast-path question`);
  return toEvents(result.response);
}

function truncate(events: AssistantEvent[], { stopAtPart, ratio }: Partial): AssistantEvent[] {
  const kept: AssistantEvent[] = [];
  for (const event of events) {
    if (event.type === 'finish') break;
    const index = 'id' in event ? Number(event.id.slice(1)) : -1;
    if (index > stopAtPart) break;
    kept.push(
      index === stopAtPart && event.type === 'text-delta'
        ? { ...event, delta: event.delta.slice(0, Math.round(event.delta.length * ratio)) }
        : event,
    );
  }
  return kept;
}

function ask(
  conversation: Conversation,
  question: string,
  options: { partial?: Partial; error?: boolean } = {},
): Conversation {
  const exchange = addExchange(conversation, question);
  const events: AssistantEvent[] = options.error
    ? [
        {
          type: 'error',
          error: {
            code: 'network',
            message: "The assistant couldn't be reached.",
            retryable: true,
          },
        },
      ]
    : options.partial
      ? truncate(eventsFor(question, exchange.conversation), options.partial)
      : eventsFor(question, exchange.conversation);
  return events.reduce(
    (current, event) => applyEvent(current, exchange.answerId, event),
    exchange.conversation,
  );
}

export interface Scenario {
  readonly conversation: Conversation;
  readonly drawerOpen: boolean;
}

const fresh = (conversation = createConversation(), drawerOpen = false): Scenario => ({
  conversation,
  drawerOpen,
});

export const SCENARIOS: Readonly<Record<string, () => Scenario>> = {
  main: () => fresh(),
  mobile: () => fresh(),
  'state-topic': () => fresh(createConversation('experience', topicIntro('experience'))),
  'state-streaming': () =>
    fresh(
      ask(createConversation(), 'What has he built at Deel?', {
        partial: { stopAtPart: 3, ratio: 0.55 },
      }),
    ),
  'state-rich-answer': () => fresh(ask(createConversation(), "Tell me about Marcio's career.")),
  'state-follow-up': () => {
    let conversation = ask(createConversation(), 'What makes Marcio a strong Staff Engineer?');
    conversation = ask(conversation, 'Tell me more about his leadership.');
    return fresh(ask(conversation, 'How did he grow the team at Roots?'));
  },
  'state-no-info': () => fresh(ask(createConversation(), 'Has he worked with GraphQL?')),
  'state-error': () =>
    fresh(
      ask(createConversation(), 'How does he approach frontend architecture?', { error: true }),
    ),
  'state-contact': () => fresh(ask(createConversation(), 'How can I contact Marcio?')),
  'mobile-drawer': () => fresh(createConversation(), true),
  'mobile-conversation': () =>
    fresh(ask(createConversation(), 'What are his biggest technical achievements?')),
};
