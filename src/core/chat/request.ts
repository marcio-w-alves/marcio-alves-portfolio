import type { TopicId } from './topic-id';

/** The longest question the composer takes and the endpoint accepts. */
export const MAX_QUESTION_LENGTH = 1200;
/** Question-and-answer exchanges of history a request may carry. */
export const MAX_HISTORY_TURNS = 12;
export const MAX_HISTORY_TEXT = 4000;

export interface HistoryTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

/** What the visitor's session carries between turns. Untrusted, and harmless if forged. */
export interface ConversationContext {
  readonly topic: TopicId;
  readonly lastIntent: string | null;
  readonly ctaShown: boolean;
}

/** What the interface sends the chat endpoint for each question. */
export interface ChatRequest {
  readonly message: string;
  readonly history: readonly HistoryTurn[];
  readonly context: ConversationContext;
}
