'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { TopicId } from '@/core/chat/topic-id';
import type { Locale } from '@/core/i18n/locale';
import { activeAnswer } from '@/core/conversation/conversation';
import type { Conversation } from '@/core/conversation/messages';

type Change = Conversation | ((current: Conversation) => Conversation);

/** Which page a conversation belongs to: a topic, in one language. */
export type ConversationKey = `${Locale}:${TopicId}`;

export function conversationKey(locale: Locale, topic: TopicId): ConversationKey {
  return `${locale}:${topic}`;
}

/** An answer on its way, and how to cancel it. */
export interface InFlightAnswer {
  readonly answerId: string;
  readonly controller: AbortController;
}

interface ConversationStore {
  readonly conversations: ReadonlyMap<ConversationKey, Conversation>;
  /** Applies a change to a page's conversation, starting from `seed` the first time. */
  readonly update: (page: ConversationKey, change: Change, seed: Conversation) => void;
  /** The answer each page is streaming, so it can be cancelled from that page. */
  readonly inFlight: Map<ConversationKey, InFlightAnswer>;
  /** Whether any page has an answer on its way: one question at a time, site-wide. */
  readonly busy: boolean;
}

const ConversationStoreContext = createContext<ConversationStore | null>(null);

/**
 * Holds every page's conversation above the pages themselves, so leaving a
 * topic — or its language — and coming back finds it as it was, an answer
 * that was streaming still streaming, for as long as the tab is open.
 */
export function ConversationsProvider({ children }: { readonly children: ReactNode }) {
  const [conversations, setConversations] = useState<ReadonlyMap<ConversationKey, Conversation>>(
    () => new Map(),
  );
  const [inFlight] = useState(() => new Map<ConversationKey, InFlightAnswer>());

  const update = useCallback((page: ConversationKey, change: Change, seed: Conversation) => {
    setConversations((current) => {
      const previous = current.get(page) ?? seed;
      return new Map(current).set(page, typeof change === 'function' ? change(previous) : change);
    });
  }, []);

  // Every page reads the store, so its value changes only when a conversation does.
  const store = useMemo<ConversationStore>(
    () => ({
      conversations,
      update,
      inFlight,
      busy: [...conversations.values()].some((conversation) => activeAnswer(conversation)),
    }),
    [conversations, update, inFlight],
  );

  return <ConversationStoreContext value={store}>{children}</ConversationStoreContext>;
}

export function useConversationStore(): ConversationStore {
  const store = useContext(ConversationStoreContext);
  if (!store) throw new Error('useConversationStore must be used inside ConversationsProvider.');
  return store;
}
