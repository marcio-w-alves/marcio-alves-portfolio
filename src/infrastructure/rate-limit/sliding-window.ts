interface Options {
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: () => number;
}

export interface Admission {
  readonly allowed: boolean;
  /** Zero when allowed; otherwise how long until the oldest request leaves the window. */
  readonly retryAfterMs: number;
}

/**
 * At most `limit` admissions per key in any rolling `windowMs`.
 *
 * In memory, so per server instance: a speed bump that stops one visitor
 * from hammering one instance, not a global quota. The global ceilings live
 * outside the code — the platform firewall and the provider's spending limit.
 */
export function createSlidingWindowLimiter({ limit, windowMs, now = Date.now }: Options) {
  const history = new Map<string, number[]>();

  function prune(key: string, at: number): number[] {
    const recent = (history.get(key) ?? []).filter((time) => at - time < windowMs);
    if (recent.length === 0) history.delete(key);
    else history.set(key, recent);
    return recent;
  }

  return {
    admit(key: string): Admission {
      const at = now();
      const recent = prune(key, at);
      if (recent.length >= limit) {
        const oldest = recent[0] ?? at;
        return { allowed: false, retryAfterMs: windowMs - (at - oldest) };
      }
      history.set(key, [...recent, at]);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

export type SlidingWindowLimiter = ReturnType<typeof createSlidingWindowLimiter>;
