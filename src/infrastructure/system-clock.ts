import type { ClockPort } from '@/core/assistant/ports/clock.port';

export const systemClock: ClockPort = {
  now: () => new Date(),
};
