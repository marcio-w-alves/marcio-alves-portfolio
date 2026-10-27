import { serverEnv, type ServerEnv } from '@/env';
import { systemClock } from '@/infrastructure/system-clock';
import type { ClockPort } from '@/core/assistant/ports/clock.port';

/**
 * The only place where concrete adapters are bound to the ports the core
 * depends on. Nothing under `src/core` may import from here.
 */
export interface Container {
  readonly env: ServerEnv;
  readonly clock: ClockPort;
}

let container: Container | undefined;

export function getContainer(): Container {
  container ??= { env: serverEnv(), clock: systemClock };
  return container;
}
