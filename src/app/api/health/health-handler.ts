import type { ModelStatus } from '@/composition-root';
import { deployment } from '@/env';

interface Dependencies {
  readonly modelStatus: () => ModelStatus;
}

/**
 * Which build is live and whether the model is usable — never a secret, only
 * whether one is configured. `status` stays `ok` while the circuit is open:
 * the site still answers from the fast path, and `circuit` says why the model
 * does not.
 */
export function createHealthHandler({ modelStatus }: Dependencies) {
  return function handle(): Response {
    return Response.json(
      { status: 'ok', ...deployment(), ...modelStatus() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  };
}
