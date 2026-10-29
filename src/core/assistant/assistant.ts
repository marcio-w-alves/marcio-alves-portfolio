import { INTERRUPTED, type AssistantEvent } from '../chat/events';
import type { ConversationContext, HistoryTurn } from '../chat/request';
import type { Locale } from '../i18n/locale';
import { replyLocale } from './language';
import type { AnswerCachePort } from './ports/answer-cache.port';
import type { ClockPort } from './ports/clock.port';
import type { ModelBudgetPort } from './ports/model-budget.port';
import { toEvents } from './response';
import type { FastPath, FastPathResult } from './system1/fast-path';
import { normalize } from './system1/router';
import type { ModelAssistant } from './system2/model-assistant';

export interface AssistantRequest {
  readonly question: string;
  readonly history: readonly HistoryTurn[];
  readonly context: ConversationContext;
  /** The language of the page the question was asked on. */
  readonly pageLocale: Locale;
  /** Who is asking, for pacing; not an identity, and never shown to the model. */
  readonly clientId: string;
}

/** What may end an answer early: the visitor leaving, or the answer running out of time. */
export interface AnswerSignals {
  readonly visitor: AbortSignal;
  readonly deadline: AbortSignal;
}

export interface Assistant {
  answer(request: AssistantRequest, signals?: AnswerSignals): AsyncGenerator<AssistantEvent>;
}

/**
 * How a question was handled, for whoever operates the site. It deliberately
 * carries nothing the visitor wrote.
 *
 * `fast` answered from the knowledge base; anything else went to the model
 * path, where the outcome says what became of it: answered, replayed from the
 * cache, unavailable (no credential), paced by the budget, failed before
 * saying anything, interrupted part-way, or abandoned by a visitor who left.
 */
export interface AnswerReport {
  readonly path: 'fast' | 'model';
  readonly outcome:
    'answered' | 'cached' | 'unavailable' | 'paced' | 'failed' | 'interrupted' | 'abandoned';
  /** The fast path's intent, or the closest one it saw before escalating. */
  readonly intent: string | null;
  readonly clientId: string;
  readonly durationMs: number;
}

type Handling = Pick<AnswerReport, 'path' | 'outcome' | 'intent'>;

/** What a question becomes when the copy that was going to answer it cannot be rendered. */
const ESCALATED: FastPathResult = { kind: 'escalate', nearest: null };

interface Options {
  /** Answers what it recognizes from the record, for free. */
  readonly fastPath: FastPath;
  /** Null when no model credential is configured. */
  readonly modelAssistant: ModelAssistant | null;
  readonly budget: ModelBudgetPort;
  readonly answerCache: AnswerCachePort;
  readonly clock: ClockPort;
  /** The visitor gets a fallback; whoever operates the site still needs to know. */
  readonly reportError: (error: unknown) => void;
  /** Called once each answer has been given in full. */
  readonly onAnswered?: (report: AnswerReport) => void;
}

/** Passes every event through, keeping a copy, and hands back what the source returns. */
async function* recording<T, R>(source: AsyncGenerator<T, R>, into: T[]): AsyncGenerator<T, R> {
  try {
    for (;;) {
      const step = await source.next();
      if (step.done) return step.value;
      into.push(step.value);
      yield step.value;
    }
  } finally {
    // A visitor who leaves stops this generator; the source must stop with it.
    await source.return(undefined as R);
  }
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
  fastPath,
  modelAssistant,
  budget,
  answerCache,
  clock,
  reportError,
  onAnswered,
}: Options): Assistant {
  /**
   * Everything the fast path says is the profile's copy rendered over its
   * record, so copy that cannot be rendered must cost the visitor only what
   * it was going to say: the question is escalated like one the fast path
   * does not recognize, and a suggestion goes unmade, instead of the answer
   * being lost. The answers of last resort have nothing behind them, so a
   * failure there is the stream's to report.
   */
  function rendered<T>(render: () => T, whenBroken: T): T {
    try {
      return render();
    } catch (error) {
      reportError(error);
      return whenBroken;
    }
  }

  async function* respond(
    { question, history, context, pageLocale, clientId }: AssistantRequest,
    signals: AnswerSignals | undefined,
  ): AsyncGenerator<AssistantEvent, Handling> {
    const routed = rendered(() => fastPath.answer(question, context, pageLocale), ESCALATED);
    if (routed.kind === 'answered') {
      yield* toEvents(routed.response);
      return { path: 'fast', outcome: 'answered', intent: routed.response.intent };
    }
    const escalated = (outcome: Handling['outcome']): Handling => ({
      path: 'model',
      outcome,
      intent: routed.nearest,
    });
    const locale = replyLocale(question, pageLocale);
    if (!modelAssistant) {
      yield* toEvents(fastPath.unknown(locale));
      return escalated('unavailable');
    }

    const followUps = rendered(() => fastPath.followUpsFor(routed.nearest, context, locale), []);
    // Only a question asked without history means the same thing every time —
    // on the same page, since a topic page changes what is worth saying, and in
    // the same language, since "React?" is answered in the page's.
    const cacheKey =
      history.length === 0 ? `${pageLocale}:${context.topic}:${normalize(question)}` : null;
    const cached = cacheKey === null ? undefined : answerCache.get(cacheKey);
    if (cached) {
      yield* cached;
      return escalated('cached');
    }
    if (!budget.admit(clientId)) {
      yield* toEvents(fastPath.slowDown(locale, followUps));
      return escalated('paced');
    }

    const emitted: AssistantEvent[] = [];
    const signal = signals && AbortSignal.any([signals.visitor, signals.deadline]);
    try {
      const page = rendered(() => fastPath.pageShown(context, pageLocale), null);
      const { shareable } = yield* recording(
        modelAssistant.answer(
          { question, clientId, history, followUps, page, pageLocale, answerLocale: locale },
          signal,
        ),
        emitted,
      );
      // Stored only once the answer finished, so an interrupted one is never replayed.
      if (cacheKey !== null && shareable && emitted.at(-1)?.type === 'finish') {
        answerCache.set(cacheKey, emitted);
      }
      return escalated('answered');
    } catch (error) {
      // A visitor who left is not a failure, and there is no one to answer.
      if (signals?.visitor.aborted) return escalated('abandoned');
      // Nor is running out of time; whoever streams the answer tells the visitor.
      if (signals?.deadline.aborted) return escalated('interrupted');
      reportError(error);
      if (emitted.length === 0) {
        yield* toEvents(fastPath.unknown(locale));
        return escalated('failed');
      }
      yield INTERRUPTED;
      return escalated('interrupted');
    }
  }

  return {
    async *answer(request, signals) {
      const startedAt = clock.now().getTime();
      const handling = yield* respond(request, signals);
      onAnswered?.({
        ...handling,
        clientId: request.clientId,
        durationMs: clock.now().getTime() - startedAt,
      });
    },
  };
}
