'use client';

import { useState } from 'react';
import type { TopicId } from '@/core/assistant/topics';
import {
  activeAnswer,
  addExchange,
  applyEvent,
  contextOf,
  createConversation,
  historyOf,
  removeExchange,
  setFeedback,
  stopAnswer,
} from '@/core/conversation/conversation';
import type { Conversation, Feedback } from '@/core/conversation/messages';
import { streamAnswer } from './chat-client';
import { useConversationStore } from './conversation-store';

/**
 * The live conversation of one page: the pure transitions from the core,
 * driven by the answer stream from `/api/chat`. One answer streams at a time
 * per page; starting over, retrying or editing cancels the one in flight.
 * The conversation itself lives in the store, so it outlasts the page.
 */
export function useChat(topic: TopicId, initial?: Conversation) {
  const store = useConversationStore();
  const [seed] = useState(() => initial ?? createConversation(topic));
  const conversation = store.conversations.get(topic) ?? seed;
  const [announcement, setAnnouncement] = useState('');

  function setConversation(change: Conversation | ((current: Conversation) => Conversation)) {
    store.update(topic, change, seed);
  }

  function cancel() {
    store.inFlight.get(topic)?.abort();
    store.inFlight.delete(topic);
  }

  async function stream(answerId: string, question: string, from: Conversation) {
    cancel();
    const controller = new AbortController();
    store.inFlight.set(topic, controller);
    setAnnouncement('Generating an answer');
    const request = { message: question, history: historyOf(from), context: contextOf(from) };
    for await (const event of streamAnswer(request, { signal: controller.signal })) {
      setConversation((current) => applyEvent(current, answerId, event));
      if (event.type === 'finish') setAnnouncement('Answer ready');
      if (event.type === 'error') {
        setAnnouncement("The answer couldn't be loaded. Retry is available.");
      }
    }
    if (store.inFlight.get(topic) === controller) store.inFlight.delete(topic);
  }

  function ask(raw: string): boolean {
    const question = raw.trim();
    // One question at a time across the whole site, this page included.
    if (!question || store.busy) return false;
    // History is taken from before the question, so it is not sent twice.
    const exchange = addExchange(conversation, question);
    setConversation(exchange.conversation);
    void stream(exchange.answerId, question, conversation);
    return true;
  }

  function stop() {
    cancel();
    const answer = activeAnswer(conversation);
    if (!answer) return;
    setConversation((current) => stopAnswer(current, answer.id));
    setAnnouncement('Response stopped');
  }

  function retry(answerId: string) {
    if (store.busy && !activeAnswer(conversation)) return;
    const removed = removeExchange(conversation, answerId);
    if (!removed.question) return;
    const exchange = addExchange(removed.conversation, removed.question);
    setConversation(exchange.conversation);
    void stream(exchange.answerId, removed.question, removed.conversation);
  }

  /** Takes the exchange out and returns its question, for the composer to hold. */
  function edit(answerId: string): string {
    cancel();
    const removed = removeExchange(conversation, answerId);
    setConversation(removed.conversation);
    return removed.question;
  }

  function rate(answerId: string, feedback: Feedback) {
    setConversation((current) => setFeedback(current, answerId, feedback));
  }

  function startOver() {
    cancel();
    setConversation(createConversation(topic));
    setAnnouncement('New conversation started');
  }

  return {
    conversation,
    announcement,
    streaming: activeAnswer(conversation) !== undefined,
    /** Another page has an answer on its way, so this one waits. */
    waiting: store.busy && activeAnswer(conversation) === undefined,
    ask,
    stop,
    retry,
    edit,
    rate,
    startOver,
  };
}
