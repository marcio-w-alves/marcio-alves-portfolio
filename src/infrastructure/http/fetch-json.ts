import type { z } from 'zod';
import type { Logger } from '../logging/logger';

export interface JsonRequest<T> {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  /** What the adapter reads. Unknown fields are dropped, so additions upstream never break it. */
  readonly schema: z.ZodType<T>;
}

/** Who asked, for the log line written when the answer is unusable. */
export interface JsonCaller {
  readonly logger: Logger;
  readonly adapter: string;
  readonly operation: string;
}

type DegradedCause = 'status' | 'shape' | 'timeout' | 'network';

function causeOf(error: unknown): DegradedCause {
  if (error instanceof SyntaxError) return 'shape';
  return error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
}

/**
 * A third-party JSON read that degrades to null instead of throwing, and
 * says why: a bad status, a body that is not what the adapter reads, a
 * timeout or a network failure. Only the kind and the status are logged —
 * never the URL or the body, which may carry what a visitor asked about.
 */
export async function fetchJson<T>(
  { url, headers, timeoutMs, schema }: JsonRequest<T>,
  { logger, adapter, operation }: JsonCaller,
): Promise<T | null> {
  function degrade(cause: DegradedCause, status: number | null = null): null {
    logger.warn('adapter.degraded', { adapter, operation, cause, status });
    return null;
  }

  let response: Response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return degrade(causeOf(error));
  }
  if (!response.ok) return degrade('status', response.status);
  try {
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : degrade('shape', response.status);
  } catch (error) {
    return degrade(causeOf(error), response.status);
  }
}
