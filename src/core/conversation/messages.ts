import type { AnswerSource, AssistantError } from '../chat/events';
import type { RichComponent } from '../chat/components';
import type { TopicId } from '../chat/topic-id';

export type MessagePart =
  | { readonly type: 'text'; readonly id: string; readonly text: string }
  | ({ readonly type: 'component'; readonly id: string } & RichComponent);

export type AnswerStatus = 'pending' | 'streaming' | 'done' | 'stopped' | 'error';
export type Feedback = 'up' | 'down';

export interface UserMessage {
  readonly id: string;
  readonly role: 'user';
  readonly text: string;
}

export interface AssistantMessage {
  readonly id: string;
  readonly role: 'assistant';
  /** An `intro` is the local text a topic opens with; an `answer` replies to a question. */
  readonly kind: 'intro' | 'answer';
  readonly status: AnswerStatus;
  readonly parts: readonly MessagePart[];
  readonly followUps: readonly string[];
  readonly sources: readonly AnswerSource[];
  readonly related: string | null;
  readonly intent: string | null;
  readonly feedback: Feedback | null;
  readonly error: AssistantError | null;
  readonly question: string | null;
  readonly topicId: TopicId | null;
}

export type Message = UserMessage | AssistantMessage;

export interface Conversation {
  readonly messages: readonly Message[];
  readonly topic: TopicId;
  readonly lastIntent: string | null;
  readonly ctaShown: boolean;
}
