'use client';

import { useState } from 'react';
import type { TopicId } from '@/core/chat/topic-id';
import {
  activeAnswer,
  addExchange,
  applyEvent,
  contextOf,
  historyOf,
  removeExchange,
  setFeedback,
  stopAnswer,
} from '@/core/conversation/conversation';
import type { Conversation, Feedback } from '@/core/conversation/messages';
import { useLocale, useMessages } from '../i18n/i18n-provider';
import { streamAnswer } from './chat-client';
import { conversationKey, useConversationStore } from './conversation-store';

/**
 * The live conversation of one page — a topic, in the page's language: the
 * pure transitions from the core, driven by the answer stream from `/api/chat`. One answer streams at a time
 * per page; starting over, retrying or editing cancels the one in flight.
 * The conversation itself lives in the store, so it outlasts the page.
 */
export function useChat(topic: TopicId, opening: Conversation, initial?: Conversation) {
  const { announcements } = useMessages();
  const locale = useLocale();
  const page = conversationKey(locale, topic);
  const store = useConversationStore();
  const [seed] = useState(() => initial ?? opening);
  const conversation = store.conversations.get(page) ?? seed;
  const [announcement, setAnnouncement] = useState('');

  function setConversation(change: Conversation | ((current: Conversation) => Conversation)) {
    store.update(page, change, seed);
  }

  /** Aborts the answer on its way, if any, and marks it stopped so nothing waits on it. */
  function cancel() {
    const inFlight = store.inFlight.get(page);
    if (!inFlight) return;
    inFlight.controller.abort();
    store.inFlight.delete(page);
    setConversation((current) => stopAnswer(current, inFlight.answerId));
    setAnnouncement(announcements.stopped);
  }

  async function stream(answerId: string, question: string, from: Conversation) {
    cancel();
    const controller = new AbortController();
    store.inFlight.set(page, { answerId, controller });
    setAnnouncement(announcements.generating);
    const request = {
      message: question,
      history: historyOf(from),
      context: contextOf(from),
      locale,
    };
    for await (const event of streamAnswer(request, { signal: controller.signal })) {
      setConversation((current) => applyEvent(current, answerId, event));
      if (event.type === 'finish') setAnnouncement(announcements.ready);
      if (event.type === 'error') setAnnouncement(announcements.failed);
    }
    if (store.inFlight.get(page)?.controller === controller) store.inFlight.delete(page);
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
    setConversation((current) => removeExchange(current, answerId).conversation);
    return removeExchange(conversation, answerId).question;
  }

  function rate(answerId: string, feedback: Feedback) {
    setConversation((current) => setFeedback(current, answerId, feedback));
  }

  function startOver() {
    cancel();
    setConversation(opening);
    setAnnouncement(announcements.newConversation);
  }

  return {
    conversation,
    announcement,
    streaming: activeAnswer(conversation) !== undefined,
    /** Another page has an answer on its way, so this one waits. */
    waiting: store.busy && activeAnswer(conversation) === undefined,
    ask,
    stop: cancel,
    retry,
    edit,
    rate,
    startOver,
  };
}
