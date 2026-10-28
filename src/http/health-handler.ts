import { deployment } from '@/env';

type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * What the health check may say about the model: whether it is configured,
 * and whether it and retrieval are reachable.
 */
export interface ModelStatus {
  readonly model: 'enabled' | 'disabled';
  /** The chat model's circuit. Null when there is no model to guard. */
  readonly circuit: CircuitState | null;
  /** The embeddings circuit behind search. Null when there is no model to guard. */
  readonly retrieval: CircuitState | null;
}

interface Dependencies {
  readonly modelStatus: () => ModelStatus;
}

/**
 * Which build is live and whether the model is usable — never a secret, only
 * whether one is configured. `status` stays `ok` while a circuit is open:
 * the site still answers from the fast path, and `circuit` says why the model
 * does not; with `retrieval` open, the model answers without search.
 */
export function createHealthHandler({ modelStatus }: Dependencies) {
  return function handle(): Response {
    return Response.json(
      { status: 'ok', ...deployment(), ...modelStatus() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  };
}
