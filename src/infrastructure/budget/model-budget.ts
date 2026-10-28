import type { ModelBudgetPort } from '@/core/assistant/ports/model-budget.port';
import { createSlidingWindowLimiter } from '../rate-limit/sliding-window';

interface Options {
  /** Model answers one client may start in any rolling window. */
  readonly answersPerWindow: number;
  readonly windowMs: number;
  /** Input plus output tokens this instance may spend per UTC day. */
  readonly dailyTokens: number;
  readonly now?: () => number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-client pacing and a daily token ceiling, in memory. Like the request
 * limiter it is per instance — defence in depth beneath the provider's own
 * spending limit, which is the hard cap.
 */
export function createModelBudget({
  answersPerWindow,
  windowMs,
  dailyTokens,
  now = Date.now,
}: Options): ModelBudgetPort {
  const perClient = createSlidingWindowLimiter({ limit: answersPerWindow, windowMs, now });
  let day = Math.floor(now() / DAY_MS);
  let spent = 0;

  function rollOver(): void {
    const today = Math.floor(now() / DAY_MS);
    if (today !== day) {
      day = today;
      spent = 0;
    }
  }

  return {
    admit(clientId) {
      rollOver();
      // The budget is checked first, so an exhausted day does not also burn
      // the visitor's per-client allowance.
      return spent < dailyTokens && perClient.admit(clientId).allowed;
    },
    record({ inputTokens, outputTokens }) {
      rollOver();
      spent += inputTokens + outputTokens;
    },
  };
}
