'use client';

import { useEffect, useRef, useState } from 'react';
import type { TopicId } from '@/core/assistant/topics';
import {
  activeAnswer,
  addExchange,
  applyEvent,
  contextOf,
  createConversation,
  historyOf,
  removeExchange,
  selectTopic,
  setFeedback,
  stopAnswer,
} from '@/core/conversation/conversation';
import type { Conversation, Feedback } from '@/core/conversation/messages';
import { streamAnswer } from './chat-client';

/**
 * The live conversation: the pure transitions from the core, driven by the
 * answer stream from `/api/chat`. One answer streams at a time; starting
 * over, retrying or editing cancels the one in flight.
 */
export function useChat() {
  const [conversation, setConversation] = useState<Conversation>(() => createConversation());
  const [announcement, setAnnouncement] = useState('');
  const inFlight = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );

  function cancel() {
    inFlight.current?.abort();
    inFlight.current = null;
  }

  async function stream(answerId: string, question: string, from: Conversation) {
    cancel();
    const controller = new AbortController();
    inFlight.current = controller;
    setAnnouncement('Generating an answer');
    const request = { message: question, history: historyOf(from), context: contextOf(from) };
    for await (const event of streamAnswer(request, { signal: controller.signal })) {
      setConversation((current) => applyEvent(current, answerId, event));
      if (event.type === 'finish') setAnnouncement('Answer ready');
      if (event.type === 'error') {
        setAnnouncement("The answer couldn't be loaded. Retry is available.");
      }
    }
    if (inFlight.current === controller) inFlight.current = null;
  }

  function ask(raw: string): boolean {
    const question = raw.trim();
    if (!question || activeAnswer(conversation)) return false;
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

  function pickTopic(topic: TopicId) {
    setConversation((current) => selectTopic(current, topic));
  }

  function startOver() {
    cancel();
    setConversation((current) => createConversation(current.topic));
    setAnnouncement('New conversation started');
  }

  return {
    conversation,
    announcement,
    streaming: activeAnswer(conversation) !== undefined,
    ask,
    stop,
    retry,
    edit,
    rate,
    pickTopic,
    startOver,
  };
}
