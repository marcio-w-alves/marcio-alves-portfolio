import type { AssistantEvent } from '../assistant/assistant-event';
import type { ConversationContext } from '../assistant/response';
import { suggestions, topicById, type TopicId } from '../assistant/topics';
import type {
  AssistantMessage,
  Conversation,
  Feedback,
  HistoryTurn,
  UserMessage,
} from './messages';
import { toPlainText } from './plain-text';

/**
 * The conversation as immutable transitions. The interface holds one
 * `Conversation` value and replaces it with what these functions return;
 * nothing here touches the DOM, timers or the network.
 */

const HISTORY_LIMIT = 12;
const INTRO_FOLLOW_UPS = 3;

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function assistantMessage(
  kind: AssistantMessage['kind'],
  fields: Partial<AssistantMessage>,
): AssistantMessage {
  return {
    id: newId(kind),
    role: 'assistant',
    kind,
    status: 'pending',
    parts: [],
    followUps: [],
    sources: [],
    related: null,
    intent: null,
    feedback: null,
    error: null,
    question: null,
    topicId: null,
    ...fields,
  };
}

function updateAnswer(
  conversation: Conversation,
  id: string,
  change: (message: AssistantMessage) => Partial<AssistantMessage>,
): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.id === id && message.role === 'assistant'
        ? { ...message, ...change(message) }
        : message,
    ),
  };
}

function findAnswer(conversation: Conversation, id: string): AssistantMessage | undefined {
  return conversation.messages.find(
    (message): message is AssistantMessage => message.id === id && message.role === 'assistant',
  );
}

export function createConversation(topic: TopicId = 'overview'): Conversation {
  return { messages: [], topic, lastIntent: null, ctaShown: false };
}

/**
 * Topics are entry points into the same thread: choosing one appends a local,
 * curated introduction — never a model call — and keeps every earlier message.
 */
export function selectTopic(conversation: Conversation, topic: TopicId): Conversation {
  const next = { ...conversation, topic };
  if (conversation.messages.length === 0 && topic === 'overview') return next;
  const last = conversation.messages.at(-1);
  if (last?.role === 'assistant' && last.kind === 'intro' && last.topicId === topic) return next;
  const intro = assistantMessage('intro', {
    status: 'done',
    topicId: topic,
    parts: [{ type: 'text', id: 'intro', text: topicById(topic).intro }],
    followUps: suggestions(topic, 0, INTRO_FOLLOW_UPS),
  });
  return { ...next, messages: [...conversation.messages, intro] };
}

export function addExchange(
  conversation: Conversation,
  question: string,
): { readonly conversation: Conversation; readonly answerId: string } {
  const user: UserMessage = { id: newId('user'), role: 'user', text: question };
  const answer = assistantMessage('answer', { question });
  return {
    conversation: { ...conversation, messages: [...conversation.messages, user, answer] },
    answerId: answer.id,
  };
}

export function applyEvent(
  conversation: Conversation,
  answerId: string,
  event: AssistantEvent,
): Conversation {
  switch (event.type) {
    case 'start':
      return updateAnswer(conversation, answerId, () => ({
        status: 'streaming',
        intent: event.intent,
        related: event.related,
      }));
    case 'text-start':
      return updateAnswer(conversation, answerId, (message) => ({
        parts: [...message.parts, { type: 'text', id: event.id, text: '' }],
      }));
    case 'text-delta':
      return updateAnswer(conversation, answerId, (message) => ({
        status: 'streaming',
        parts: message.parts.map((part) =>
          part.id === event.id && part.type === 'text'
            ? { ...part, text: part.text + event.delta }
            : part,
        ),
      }));
    case 'text-end':
      return conversation;
    case 'component': {
      const { type: _event, ...component } = event;
      return updateAnswer(conversation, answerId, (message) => ({
        parts: [...message.parts, { type: 'component', ...component }],
      }));
    }
    case 'finish': {
      const answer = findAnswer(conversation, answerId);
      const showedContact =
        answer?.parts.some((part) => part.type === 'component' && part.component === 'contact') ??
        false;
      return {
        ...updateAnswer(conversation, answerId, () => ({
          status: 'done',
          followUps: event.followUps,
          sources: event.sources,
        })),
        lastIntent: answer?.intent ?? conversation.lastIntent,
        ctaShown: conversation.ctaShown || showedContact,
      };
    }
    case 'error':
      return updateAnswer(conversation, answerId, () => ({ status: 'error', error: event.error }));
  }
}

export function stopAnswer(conversation: Conversation, answerId: string): Conversation {
  const answer = findAnswer(conversation, answerId);
  if (answer?.status !== 'pending' && answer?.status !== 'streaming') return conversation;
  return updateAnswer(conversation, answerId, () => ({ status: 'stopped' }));
}

/**
 * Takes an answer out together with the question before it, and hands the
 * question back so it can be edited or asked again.
 */
export function removeExchange(
  conversation: Conversation,
  answerId: string,
): { readonly conversation: Conversation; readonly question: string } {
  const index = conversation.messages.findIndex((message) => message.id === answerId);
  const answer = conversation.messages[index];
  if (answer?.role !== 'assistant') return { conversation, question: '' };
  const previous = conversation.messages[index - 1];
  const start = previous?.role === 'user' ? index - 1 : index;
  return {
    conversation: {
      ...conversation,
      messages: [
        ...conversation.messages.slice(0, start),
        ...conversation.messages.slice(index + 1),
      ],
    },
    question: answer.question ?? (previous?.role === 'user' ? previous.text : ''),
  };
}

/** Choosing the same rating again clears it. */
export function setFeedback(
  conversation: Conversation,
  answerId: string,
  feedback: Feedback,
): Conversation {
  return updateAnswer(conversation, answerId, (message) => ({
    feedback: message.feedback === feedback ? null : feedback,
  }));
}

export function activeAnswer(conversation: Conversation): AssistantMessage | undefined {
  return conversation.messages.findLast(
    (message): message is AssistantMessage =>
      message.role === 'assistant' &&
      (message.status === 'pending' || message.status === 'streaming'),
  );
}

export function latestAnswerId(conversation: Conversation): string | undefined {
  return conversation.messages.findLast((message) => message.role === 'assistant')?.id;
}

export function contextOf(conversation: Conversation): ConversationContext {
  return {
    topic: conversation.topic,
    lastIntent: conversation.lastIntent,
    ctaShown: conversation.ctaShown,
  };
}

/** What the server is told of earlier turns: questions and finished answers, as plain text. */
export function historyOf(conversation: Conversation): HistoryTurn[] {
  return conversation.messages
    .filter(
      (message) =>
        message.role === 'user' || (message.kind === 'answer' && message.status === 'done'),
    )
    .slice(-HISTORY_LIMIT)
    .map((message) =>
      message.role === 'user'
        ? { role: 'user', text: message.text }
        : { role: 'assistant', text: toPlainText(message.parts) },
    );
}
