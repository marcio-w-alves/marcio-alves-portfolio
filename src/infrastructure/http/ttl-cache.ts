/**
 * Remembers successful lookups for a while, per server instance.
 *
 * Failures are not remembered: an encyclopedia that rate-limited one request
 * should be asked again on the next, not reported as missing for an hour.
 */
export function cacheSuccesses<Value>(
  ttlMs: number,
  load: (key: string) => Promise<Value | null>,
  now: () => number = Date.now,
): (key: string) => Promise<Value | null> {
  const entries = new Map<string, { readonly value: Value; readonly expiresAt: number }>();
  return async (key) => {
    const hit = entries.get(key);
    if (hit && hit.expiresAt > now()) return hit.value;
    const value = await load(key);
    if (value !== null) entries.set(key, { value, expiresAt: now() + ttlMs });
    return value;
  };
}
