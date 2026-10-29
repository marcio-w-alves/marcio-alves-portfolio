import type { ConversationContext } from '../chat/request';
import type { AnswerLabels } from './answer-labels';
import type { AssistantResponse } from './response';
import type { ResponseKit } from './response-kit';
import type { ScoredIntent, Vocabulary } from './system1/intents';
import type { TechnologyEvidence } from './system1/technologies';
import type { TopicId } from '../chat/topic-id';
import type { TopicCopy } from './topics';

/**
 * What the fast path says, written by the profile. The core recognizes the
 * question and hands over the record (through the kit); the profile's copy
 * turns the record's facts into prose. Nothing here names anyone, so the same
 * engine answers for any profile.
 */

export type AnswerBuilder = (context: ConversationContext, question: string) => AssistantResponse;

export interface Answers {
  /** An intent the profile's copy leaves out has no answer, and the fast path escalates it. */
  readonly scored: Readonly<Partial<Record<ScoredIntent, AnswerBuilder>>>;
  readonly greeting: () => AssistantResponse;
  readonly privateInfo: () => AssistantResponse;
  readonly offPurpose: () => AssistantResponse;
  /** The answer of last resort, used only when the model-backed path is unavailable. */
  readonly unknown: () => AssistantResponse;
  /** For a visitor who has used up their share of model answers. */
  readonly slowDown: (followUps: readonly string[]) => AssistantResponse;
  readonly company: (roleId: string) => AssistantResponse;
  readonly project: (projectId: string) => AssistantResponse;
  /** Reports where each technology appears in the record, without upgrading one kind into another. */
  readonly technology: (evidence: readonly TechnologyEvidence[]) => AssistantResponse;
}

/** One locale's copy for the fast path and the topic pages. */
export interface AnswerSet {
  /** The owner's own words for some intents, added to the router's generic rules. */
  readonly vocabulary: Vocabulary;
  /** The words inside the answers' cards, in this locale. */
  readonly labels: AnswerLabels;
  readonly topics: (kit: ResponseKit) => Readonly<Record<TopicId, TopicCopy>>;
  readonly answers: (kit: ResponseKit) => Answers;
}
