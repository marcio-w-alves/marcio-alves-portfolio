import type { AssistantEvent } from './assistant-event';
import { toEvents, type ConversationContext } from './response';
import { fastPath, followUpsFor } from './system1/fast-path';
import { unknown } from './system1/responses/boundaries';
import type { HistoryTurn, ModelAssistant } from './system2/model-assistant';

export interface AssistantRequest {
  readonly question: string;
  readonly history: readonly HistoryTurn[];
  readonly context: ConversationContext;
}

export interface Assistant {
  answer(request: AssistantRequest, signal?: AbortSignal): AsyncGenerator<AssistantEvent>;
}

interface Options {
  /** Null when no model credential is configured. */
  readonly modelAssistant: ModelAssistant | null;
  /** The visitor gets a fallback; whoever operates the site still needs to know. */
  readonly reportError: (error: unknown) => void;
}

/**
 * Both paths behind one contract. The fast path answers what it recognizes;
 * the model answers the rest. When the model is unavailable — no credential,
 * an open circuit, a failure before it said anything — the visitor still gets
 * an honest answer instead of an error, and everything the fast path
 * recognizes keeps working.
 */
export function createAssistant({ modelAssistant, reportError }: Options): Assistant {
  return {
    async *answer({ question, history, context }, signal) {
      const routed = fastPath(question, context);
      if (routed.kind === 'answered') {
        yield* toEvents(routed.response);
        return;
      }
      if (!modelAssistant) {
        yield* toEvents(unknown());
        return;
      }

      let started = false;
      try {
        const followUps = followUpsFor(routed.nearest, context);
        for await (const event of modelAssistant.answer({ question, history, followUps }, signal)) {
          started = true;
          yield event;
        }
      } catch (error) {
        reportError(error);
        if (!started) {
          yield* toEvents(unknown());
          return;
        }
        yield {
          type: 'error',
          error: {
            code: 'internal',
            message: 'The answer was interrupted. Please try again.',
            retryable: true,
          },
        };
      }
    },
  };
}
