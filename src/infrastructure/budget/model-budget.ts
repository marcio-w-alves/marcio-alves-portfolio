import type { ModelBudgetPort } from '@/core/assistant/ports/model-budget.port';
import { createSlidingWindowLimiter } from '../rate-limit/sliding-window';

interface Options {
  /** Model answers one client may start in any rolling window. */
  readonly answersPerWindow: number;
  readonly windowMs: number;
  /** Input plus output tokens this instance may spend per UTC day. */
  readonly dailyTokens: number;
  /**
   * The share of a day's tokens one client may spend, so a few scripted
   * clients cannot switch the model off for everyone until midnight.
   */
  readonly clientDailyTokens: number;
  readonly now?: () => number;
  /** Told once per day, at the answer that spends the last of the day's tokens. */
  readonly onExhausted?: () => void;
  /** Told at most once per window, when too many clients force one out of the pacing. */
  readonly onEvicted?: () => void;
}

export interface ModelBudget extends ModelBudgetPort {
  /** How many clients the per-client pacing is tracking right now. */
  trackedClients(): number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Like the limiters', a bound on memory: past it the oldest client's tally is dropped. */
const MAX_TRACKED_SPENDERS = 50_000;

/**
 * Per-client pacing and a daily token ceiling, in memory. Like the request
 * limiter it is per instance — defence in depth beneath the provider's own
 * spending limit, which is the hard cap.
 */
export function createModelBudget({
  answersPerWindow,
  windowMs,
  dailyTokens,
  clientDailyTokens,
  now = Date.now,
  onExhausted,
  onEvicted,
}: Options): ModelBudget {
  const perClient = createSlidingWindowLimiter({
    limit: answersPerWindow,
    windowMs,
    now,
    ...(onEvicted ? { onEvicted } : {}),
  });
  let day = Math.floor(now() / DAY_MS);
  let spent = 0;
  const spentBy = new Map<string, number>();

  function rollOver(): void {
    const today = Math.floor(now() / DAY_MS);
    if (today !== day) {
      day = today;
      spent = 0;
      spentBy.clear();
    }
  }

  function charge(clientId: string, tokens: number): void {
    const total = (spentBy.get(clientId) ?? 0) + tokens;
    spentBy.delete(clientId);
    spentBy.set(clientId, total);
    if (spentBy.size > MAX_TRACKED_SPENDERS) {
      const oldest = spentBy.keys().next().value;
      if (oldest !== undefined) spentBy.delete(oldest);
    }
  }

  return {
    admit(clientId) {
      rollOver();
      // The budget is checked first, so an exhausted day does not also burn
      // the visitor's per-client allowance.
      return (
        spent < dailyTokens &&
        (spentBy.get(clientId) ?? 0) < clientDailyTokens &&
        perClient.admit(clientId).allowed
      );
    },
    record({ inputTokens, outputTokens }, clientId) {
      rollOver();
      const hadBudget = spent < dailyTokens;
      spent += inputTokens + outputTokens;
      charge(clientId, inputTokens + outputTokens);
      if (hadBudget && spent >= dailyTokens) onExhausted?.();
    },
    trackedClients: () => perClient.size(),
  };
}
