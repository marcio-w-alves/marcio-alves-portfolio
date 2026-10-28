'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { TopicId } from '@/core/assistant/topics';
import type { Conversation } from '@/core/conversation/messages';

type Change = Conversation | ((current: Conversation) => Conversation);

interface ConversationStore {
  readonly conversations: ReadonlyMap<TopicId, Conversation>;
  /** Applies a change to a page's conversation, starting from `seed` the first time. */
  readonly update: (topic: TopicId, change: Change, seed: Conversation) => void;
  /** The answer each page is streaming, so it can be cancelled from that page. */
  readonly inFlight: Map<TopicId, AbortController>;
}

const ConversationStoreContext = createContext<ConversationStore | null>(null);

/**
 * Holds every page's conversation above the pages themselves, so leaving a
 * topic and coming back finds it as it was — an answer that was streaming
 * keeps streaming — for as long as the tab is open.
 */
export function ConversationsProvider({ children }: { readonly children: ReactNode }) {
  const [conversations, setConversations] = useState<ReadonlyMap<TopicId, Conversation>>(
    () => new Map(),
  );
  const [inFlight] = useState(() => new Map<TopicId, AbortController>());

  function update(topic: TopicId, change: Change, seed: Conversation) {
    setConversations((current) => {
      const previous = current.get(topic) ?? seed;
      return new Map(current).set(topic, typeof change === 'function' ? change(previous) : change);
    });
  }

  return (
    <ConversationStoreContext value={{ conversations, update, inFlight }}>
      {children}
    </ConversationStoreContext>
  );
}

export function useConversationStore(): ConversationStore {
  const store = useContext(ConversationStoreContext);
  if (!store) throw new Error('useConversationStore must be used inside ConversationsProvider.');
  return store;
}
