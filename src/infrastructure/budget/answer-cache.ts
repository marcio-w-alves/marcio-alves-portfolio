import type { AssistantEvent } from '@/core/chat/events';
import type { AnswerCachePort } from '@/core/assistant/ports/answer-cache.port';

interface Options {
  readonly ttlMs: number;
  /** Bounded, so the cache cannot grow without limit on a long-lived instance. */
  readonly maxEntries: number;
  readonly now?: () => number;
}

export function createAnswerCache({ ttlMs, maxEntries, now = Date.now }: Options): AnswerCachePort {
  const entries = new Map<
    string,
    { readonly events: readonly AssistantEvent[]; readonly expiresAt: number }
  >();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.events;
    },
    set(key, events) {
      entries.delete(key);
      entries.set(key, { events, expiresAt: now() + ttlMs });
      // A Map iterates in insertion order, so the first key is the oldest.
      if (entries.size > maxEntries) {
        const [oldest] = entries.keys();
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
  };
}
