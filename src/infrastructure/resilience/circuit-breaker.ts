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
  /** Told each time it opens or closes again — the leading indicator of a provider outage. */
  readonly onTransition?: (to: 'open' | 'closed') => void;
}

/** Half-open: the cooldown is over and the next call is the trial that decides. */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Stops calling a dependency that keeps failing, so a provider outage costs
 * visitors an instant fallback instead of a timeout each, and the provider is
 * not hammered while it recovers. After the cooldown a single trial call
 * decides whether it closes again.
 */
export function createCircuitBreaker({
  failureThreshold,
  cooldownMs,
  now = Date.now,
  onTransition,
}: Options) {
  let failures = 0;
  let openUntil = 0;
  let trialInFlight = false;

  function isTripped(): boolean {
    return failures >= failureThreshold;
  }

  return {
    state(): CircuitState {
      if (!isTripped()) return 'closed';
      return now() < openUntil ? 'open' : 'half-open';
    },
    /** Throws CircuitOpenError instead of letting a doomed call through. */
    admit(): void {
      if (!isTripped()) return;
      if (now() < openUntil || trialInFlight) throw new CircuitOpenError();
      trialInFlight = true;
    },
    succeeded(): void {
      const wasTripped = isTripped();
      failures = 0;
      trialInFlight = false;
      if (wasTripped) onTransition?.('closed');
    },
    failed(): void {
      failures += 1;
      trialInFlight = false;
      if (!isTripped()) return;
      openUntil = now() + cooldownMs;
      onTransition?.('open');
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
