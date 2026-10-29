/**
 * The deployed site allows 40 chat requests per client in ten minutes, one
 * every 15 s. A capture against it keeps to that pace so it is never refused
 * part-way; a local server, started with a higher limit, is asked unpaced.
 */
export const REMOTE_CHAT_INTERVAL_MS = 15_000;

export interface Clock {
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
}

export const systemClock: Clock = {
  now: Date.now,
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalTarget(target: URL): boolean {
  return LOCAL_HOSTS.has(target.hostname);
}

export function chatIntervalFor(target: URL): number {
  return isLocalTarget(target) ? 0 : REMOTE_CHAT_INTERVAL_MS;
}

/** Waits, before each call, until `intervalMs` has passed since the previous one began. */
export function createPacer(intervalMs: number, { now, sleep }: Clock): () => Promise<void> {
  let previous = Number.NEGATIVE_INFINITY;
  return async () => {
    const wait = previous + intervalMs - now();
    if (wait > 0) await sleep(wait);
    previous = now();
  };
}
