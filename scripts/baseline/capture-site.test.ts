import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capture } from './capture-site';
import { systemClock } from './pacing';
import { scratchDir } from './testing/tool';

/**
 * A local server is captured only when its health check says the model is
 * off: any other answer — enabled, or a health check that does not say —
 * could put a model's answer in the baseline. MSW stands in for the server.
 */

const LOCAL = new URL('http://localhost:3200');
const network = setupServer();
let scratch: Awaited<ReturnType<typeof scratchDir>>;

beforeAll(() => {
  network.listen({ onUnhandledFrame: 'error' });
});
beforeEach(async () => {
  scratch = await scratchDir();
});
afterEach(async () => {
  network.resetHandlers();
  await scratch.remove();
});
afterAll(() => {
  network.close();
});

describe('a local server that may answer with the model', () => {
  it.each([
    ['reports it enabled', { status: 'ok', commit: null, model: 'enabled' }],
    ['does not say', { status: 'ok', commit: null }],
  ])('is refused when its health check %s', async (_case, health) => {
    network.use(http.get(new URL('/api/health', LOCAL).href, () => HttpResponse.json(health)));
    const out = join(scratch.path, 'baseline');

    await expect(
      capture({
        target: LOCAL,
        out,
        profile: 'fixture',
        evaluation: false,
        env: {},
        clock: systemClock,
      }),
    ).rejects.toThrow('does not report the model disabled');
    await expect(access(out)).rejects.toThrow();
  });
});
