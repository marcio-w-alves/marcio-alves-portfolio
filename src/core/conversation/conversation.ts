import type { AssistantEvent } from '../chat/events';
import {
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_TEXT,
  type ConversationContext,
  type HistoryTurn,
} from '../chat/request';
import type { TopicId } from '../chat/topic-id';
import type { TopicIntro } from '../chat/topic-intro';
import type { AssistantMessage, Conversation, Feedback, UserMessage } from './messages';
import { toPlainText } from './plain-text';

/**
 * The conversation as immutable transitions. The interface holds one
 * `Conversation` value and replaces it with what these functions return;
 * nothing here touches the DOM, timers or the network.
 */

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function assistantMessage(
  kind: AssistantMessage['kind'],
  fields: Partial<AssistantMessage>,
): AssistantMessage {
  return {
    id: fields.id ?? newId(kind),
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

/**
 * A conversation as a page opens it. The overview starts empty, as the
 * welcome screen; every other topic is a page of its own that opens with its
 * introduction and its part of the record, built locally — never a model
 * call. The introduction's ids are fixed, so the server and the browser
 * render the same page.
 */
export function createConversation(topic?: 'overview'): Conversation;
export function createConversation(topic: TopicId, intro: TopicIntro): Conversation;
export function createConversation(topic: TopicId = 'overview', intro?: TopicIntro): Conversation {
  const empty = { messages: [], topic, lastIntent: null, ctaShown: false };
  if (topic === 'overview') return empty;
  if (!intro) throw new Error(`"${topic}" opens on its introduction, and none was given.`);
  const message = assistantMessage('intro', {
    id: `intro-${topic}`,
    status: 'done',
    topicId: topic,
    parts: intro.parts.map((part, index) => ({ ...part, id: `intro-${String(index)}` })),
    followUps: intro.followUps,
  });
  return { ...empty, messages: [message] };
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
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) =>
      message.role === 'user'
        ? { role: 'user', text: message.text }
        : { role: 'assistant', text: toPlainText(message.parts).slice(0, MAX_HISTORY_TEXT) },
    );
}
