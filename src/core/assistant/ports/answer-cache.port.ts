import type { AssistantEvent } from '../assistant-event';

/** Finished model answers, kept so a repeated question costs nothing. */
export interface AnswerCachePort {
  get(key: string): readonly AssistantEvent[] | undefined;
  set(key: string, events: readonly AssistantEvent[]): void;
}
