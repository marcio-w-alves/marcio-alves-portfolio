import type { AssistantEvent } from './assistant-event';
import type { AnswerCachePort } from './ports/answer-cache.port';
import type { ModelBudgetPort } from './ports/model-budget.port';
import { toEvents, type ConversationContext } from './response';
import { fastPath, followUpsFor } from './system1/fast-path';
import { slowDown, unknown } from './system1/responses/boundaries';
import { normalize } from './system1/router';
import type { HistoryTurn, ModelAssistant } from './system2/model-assistant';

export interface AssistantRequest {
  readonly question: string;
  readonly history: readonly HistoryTurn[];
  readonly context: ConversationContext;
  /** Who is asking, for pacing; not an identity, and never shown to the model. */
  readonly clientId: string;
}

export interface Assistant {
  answer(request: AssistantRequest, signal?: AbortSignal): AsyncGenerator<AssistantEvent>;
}

interface Options {
  /** Null when no model credential is configured. */
  readonly modelAssistant: ModelAssistant | null;
  readonly budget: ModelBudgetPort;
  readonly answerCache: AnswerCachePort;
  /** The visitor gets a fallback; whoever operates the site still needs to know. */
  readonly reportError: (error: unknown) => void;
}

/**
 * Both paths behind one contract, and the policy for spending on the model.
 *
 * The fast path answers what it recognizes, for free. For the rest, in order:
 * a cached answer to the same context-free question costs nothing and does
 * not count against the visitor; then the budget decides whether a model
 * answer may be spent; then the model answers. When it is unavailable — no
 * credential, an open circuit, a failure before it said anything — the
 * visitor still gets an honest answer instead of an error.
 */
export function createAssistant({
  modelAssistant,
  budget,
  answerCache,
  reportError,
}: Options): Assistant {
  return {
    async *answer({ question, history, context, clientId }, signal) {
      const routed = fastPath(question, context);
      if (routed.kind === 'answered') {
        yield* toEvents(routed.response);
        return;
      }
      if (!modelAssistant) {
        yield* toEvents(unknown());
        return;
      }

      const followUps = followUpsFor(routed.nearest, context);
      // Only a question asked without history means the same thing every time.
      const cacheKey = history.length === 0 ? normalize(question) : null;
      const cached = cacheKey === null ? undefined : answerCache.get(cacheKey);
      if (cached) {
        yield* cached;
        return;
      }
      if (!budget.admit(clientId)) {
        yield* toEvents(slowDown(followUps));
        return;
      }

      const emitted: AssistantEvent[] = [];
      try {
        for await (const event of modelAssistant.answer({ question, history, followUps }, signal)) {
          emitted.push(event);
          yield event;
        }
        // Stored only once the answer finished, so an interrupted one is never replayed.
        if (cacheKey !== null && emitted.at(-1)?.type === 'finish') {
          answerCache.set(cacheKey, emitted);
        }
      } catch (error) {
        reportError(error);
        if (emitted.length === 0) {
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
