import { describe, expect, it } from 'vitest';
import type { AssistantEvent } from '../assistant/assistant-event';
import { toEvents } from '../assistant/response';
import { fastPath } from '../assistant/system1/fast-path';
import { topicById } from '../assistant/topics';
import {
  activeAnswer,
  addExchange,
  applyEvent,
  contextOf,
  createConversation,
  historyOf,
  latestAnswerId,
  removeExchange,
  setFeedback,
  stopAnswer,
} from './conversation';
import type { AssistantMessage, Conversation } from './messages';

/** The events the server would stream for this question, from the real fast path. */
function eventsFor(question: string, conversation: Conversation): AssistantEvent[] {
  const result = fastPath(question, contextOf(conversation));
  if (result.kind !== 'answered') throw new Error(`"${question}" is not a fast-path question`);
  return toEvents(result.response);
}

function ask(
  conversation: Conversation,
  question: string,
  events = eventsFor(question, conversation),
) {
  const exchange = addExchange(conversation, question);
  const next = events.reduce(
    (current, event) => applyEvent(current, exchange.answerId, event),
    exchange.conversation,
  );
  return { conversation: next, answerId: exchange.answerId };
}

function answer(conversation: Conversation, id: string): AssistantMessage {
  const message = conversation.messages.find((candidate) => candidate.id === id);
  if (message?.role !== 'assistant') throw new Error('no such answer');
  return message;
}

describe('asking a question', () => {
  it('adds the question and a pending answer', () => {
    const { conversation, answerId } = addExchange(
      createConversation(),
      'What did he do at Roots?',
    );
    expect(conversation.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(answer(conversation, answerId)).toMatchObject({
      status: 'pending',
      question: 'What did he do at Roots?',
    });
    expect(activeAnswer(conversation)?.id).toBe(answerId);
  });

  it('builds the answer from the streamed events and finishes it', () => {
    const { conversation, answerId } = ask(createConversation(), "Tell me about Marcio's career.");
    const done = answer(conversation, answerId);
    expect(done.status).toBe('done');
    expect(done.parts.some((part) => part.type === 'text' && part.text.includes('Toptal'))).toBe(
      true,
    );
    expect(
      done.parts.some((part) => part.type === 'component' && part.component === 'timeline'),
    ).toBe(true);
    expect(done.followUps.length).toBeGreaterThan(0);
    expect(activeAnswer(conversation)).toBeUndefined();
    expect(conversation.lastIntent).toBe(done.intent);
  });

  it('joins text deltas in order', () => {
    const exchange = addExchange(createConversation(), 'Hi');
    const events: AssistantEvent[] = [
      { type: 'start', intent: 'greeting', related: null },
      { type: 'text-start', id: 'p0' },
      { type: 'text-delta', id: 'p0', delta: 'Hello, ' },
      { type: 'text-delta', id: 'p0', delta: 'visitor.' },
      { type: 'text-end', id: 'p0' },
    ];
    const streamed = events.reduce(
      (current, event) => applyEvent(current, exchange.answerId, event),
      exchange.conversation,
    );
    expect(answer(streamed, exchange.answerId)).toMatchObject({
      status: 'streaming',
      parts: [{ type: 'text', text: 'Hello, visitor.' }],
    });
  });

  it('remembers once the contact card has been shown', () => {
    const { conversation } = ask(createConversation(), 'How can I contact Marcio?');
    expect(contextOf(conversation).ctaShown).toBe(true);
  });

  it('records a failure on the answer', () => {
    const error = {
      code: 'network',
      message: "The assistant couldn't be reached.",
      retryable: true,
    } as const;
    const { conversation, answerId } = ask(createConversation(), 'Anything', [
      { type: 'error', error },
    ]);
    expect(answer(conversation, answerId)).toMatchObject({ status: 'error', error });
  });
});

describe('stopping an answer', () => {
  it('stops one still in progress', () => {
    const { conversation, answerId } = addExchange(createConversation(), 'Tell me more');
    expect(answer(stopAnswer(conversation, answerId), answerId).status).toBe('stopped');
  });

  it('leaves a finished answer alone', () => {
    const { conversation, answerId } = ask(createConversation(), "Tell me about Marcio's career.");
    expect(stopAnswer(conversation, answerId)).toBe(conversation);
  });
});

describe('topic pages', () => {
  it('opens a topic on its introduction, its part of the record and its suggestions', () => {
    const conversation = createConversation('experience');
    const [intro] = conversation.messages;
    expect(conversation.topic).toBe('experience');
    expect(conversation.messages).toHaveLength(1);
    expect(intro).toMatchObject({ role: 'assistant', kind: 'intro', status: 'done' });
    if (intro?.role !== 'assistant') throw new Error('no introduction');
    expect(intro.parts[0]).toMatchObject({ text: topicById('experience').intro });
    expect(intro.parts[1]).toMatchObject({ type: 'component', component: 'timeline' });
    expect(intro.followUps.length).toBeGreaterThan(0);
  });

  it('builds the same page every time, so the server and the browser agree', () => {
    expect(createConversation('skills')).toEqual(createConversation('skills'));
  });

  it('opens the overview empty, as the welcome screen', () => {
    expect(createConversation('overview').messages).toHaveLength(0);
  });
});

describe('editing and retrying', () => {
  it('removes an exchange and hands its question back', () => {
    const first = ask(createConversation(), "Tell me about Marcio's career.");
    const second = ask(first.conversation, 'How did he grow the team at Roots?');
    const removed = removeExchange(second.conversation, second.answerId);
    expect(removed.question).toBe('How did he grow the team at Roots?');
    expect(removed.conversation.messages).toEqual(first.conversation.messages);
  });

  it('changes nothing for an unknown answer', () => {
    const conversation = createConversation();
    expect(removeExchange(conversation, 'missing')).toEqual({ conversation, question: '' });
  });
});

describe('feedback', () => {
  it('toggles a rating off when chosen twice', () => {
    const { conversation, answerId } = ask(createConversation(), "Tell me about Marcio's career.");
    const rated = setFeedback(conversation, answerId, 'up');
    expect(answer(rated, answerId).feedback).toBe('up');
    expect(answer(setFeedback(rated, answerId, 'down'), answerId).feedback).toBe('down');
    expect(answer(setFeedback(rated, answerId, 'up'), answerId).feedback).toBeNull();
  });
});

describe('history sent to the server', () => {
  it('carries questions and finished answers as plain text, without introductions or failures', () => {
    let conversation = createConversation('experience');
    conversation = ask(conversation, 'What did he do at Roots?').conversation;
    conversation = ask(conversation, 'Broken', [
      { type: 'error', error: { code: 'network', message: 'x', retryable: true } },
    ]).conversation;
    const history = historyOf(conversation);
    expect(history.map((turn) => turn.role)).toEqual(['user', 'assistant', 'user']);
    expect(history[1]?.text).toContain('Roots');
    expect(history[1]?.text).not.toContain('**');
  });

  it('keeps only the latest turns', () => {
    let conversation = createConversation();
    for (let turn = 0; turn < 10; turn += 1) {
      conversation = ask(conversation, "Tell me about Marcio's career.").conversation;
    }
    expect(historyOf(conversation)).toHaveLength(12);
  });

  it('points at the latest answer', () => {
    const { conversation, answerId } = ask(createConversation(), "Tell me about Marcio's career.");
    expect(latestAnswerId(conversation)).toBe(answerId);
  });
});
