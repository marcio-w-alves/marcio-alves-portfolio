import type { LanguageModelPort } from '@/core/assistant/ports/language-model.port';

export class CircuitOpenError extends Error {
  constructor() {
    super('The model is temporarily unavailable; the circuit is open.');
    this.name = 'CircuitOpenError';
  }
}

interface Options {
  /** Consecutive failures that open the circuit. */
  readonly failureThreshold: number;
  /** How long it stays open before one trial call is let through. */
  readonly cooldownMs: number;
  readonly now?: () => number;
}

/**
 * Stops calling a dependency that keeps failing, so a provider outage costs
 * visitors an instant fallback instead of a timeout each, and the provider is
 * not hammered while it recovers. After the cooldown a single trial call
 * decides whether it closes again.
 */
export function createCircuitBreaker({ failureThreshold, cooldownMs, now = Date.now }: Options) {
  let failures = 0;
  let openUntil = 0;
  let trialInFlight = false;

  return {
    /** Throws CircuitOpenError instead of letting a doomed call through. */
    admit(): void {
      if (failures < failureThreshold) return;
      if (now() < openUntil || trialInFlight) throw new CircuitOpenError();
      trialInFlight = true;
    },
    succeeded(): void {
      failures = 0;
      trialInFlight = false;
    },
    failed(): void {
      failures += 1;
      trialInFlight = false;
      if (failures >= failureThreshold) openUntil = now() + cooldownMs;
    },
    /** A call the caller cancelled says nothing about the dependency's health. */
    released(): void {
      trialInFlight = false;
    },
  };
}

export type CircuitBreaker = ReturnType<typeof createCircuitBreaker>;

function isCancellation(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'AbortError' || error.name === 'APIUserAbortError')
  );
}

export function withCircuitBreaker(
  model: LanguageModelPort,
  breaker: CircuitBreaker,
): LanguageModelPort {
  return {
    async *stream(request) {
      breaker.admit();
      let settled = false;
      try {
        yield* model.stream(request);
        settled = true;
        breaker.succeeded();
      } catch (error) {
        settled = true;
        if (isCancellation(error)) breaker.released();
        else breaker.failed();
        throw error;
      } finally {
        // A consumer that stops reading early settles nothing; without this a
        // half-open trial would stay "in flight" and the circuit never close.
        if (!settled) breaker.released();
      }
    },
  };
}
