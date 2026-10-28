interface Options {
  readonly limit: number;
  readonly windowMs: number;
  /** The most clients tracked at once; past it, the longest-tracked is forgotten. */
  readonly maxKeys?: number;
  readonly now?: () => number;
  /** Told at most once per window, when the cap forces out a client still inside it. */
  readonly onEvicted?: () => void;
}

export interface Admission {
  readonly allowed: boolean;
  /** Zero when allowed; otherwise how long until the oldest request leaves the window. */
  readonly retryAfterMs: number;
}

const DEFAULT_MAX_KEYS = 50_000;

/**
 * At most `limit` admissions per key in any rolling `windowMs`.
 *
 * In memory, so per server instance: a speed bump that stops one visitor
 * from hammering one instance, not a global quota. The global ceilings live
 * outside the code — the platform firewall and the provider's spending limit.
 *
 * Memory is bounded by the clients active within one window: once a window
 * has passed, the next request sweeps out every client not seen in it, and a
 * flood of new clients inside one window is capped at `maxKeys`.
 */
export function createSlidingWindowLimiter({
  limit,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
  now = Date.now,
  onEvicted,
}: Options) {
  // Each key's times are in ascending order, and the map in insertion order.
  const history = new Map<string, number[]>();
  let lastSweep = now();
  let evictionReported = false;

  function sweepIfDue(at: number): void {
    if (at - lastSweep < windowMs) return;
    lastSweep = at;
    evictionReported = false;
    for (const [key, times] of history) {
      if ((times.at(-1) ?? at) <= at - windowMs) history.delete(key);
    }
  }

  function prune(key: string, at: number): number[] {
    const recent = (history.get(key) ?? []).filter((time) => at - time < windowMs);
    if (recent.length === 0) history.delete(key);
    else history.set(key, recent);
    return recent;
  }

  function makeRoomFor(key: string): void {
    if (history.has(key) || history.size < maxKeys) return;
    const longestTracked = history.keys().next().value;
    if (longestTracked !== undefined) history.delete(longestTracked);
    if (!evictionReported) {
      evictionReported = true;
      onEvicted?.();
    }
  }

  return {
    admit(key: string): Admission {
      const at = now();
      sweepIfDue(at);
      const recent = prune(key, at);
      if (recent.length >= limit) {
        const oldest = recent[0] ?? at;
        return { allowed: false, retryAfterMs: windowMs - (at - oldest) };
      }
      makeRoomFor(key);
      history.set(key, [...recent, at]);
      return { allowed: true, retryAfterMs: 0 };
    },
    /** How many clients are tracked right now. */
    size: (): number => history.size,
  };
}

export type SlidingWindowLimiter = ReturnType<typeof createSlidingWindowLimiter>;
