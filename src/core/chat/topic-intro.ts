import type { ResponsePart } from './components';

/**
 * How a topic's page opens: its introduction, its part of the record, and what
 * to ask next. The server builds it from the record; the browser only renders it.
 */
export interface TopicIntro {
  readonly parts: readonly ResponsePart[];
  readonly followUps: readonly string[];
}
