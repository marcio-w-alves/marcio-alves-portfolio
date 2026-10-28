import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatHandler } from '@/app/api/chat/chat-handler';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { buildContainer } from './composition-root';

const VISITOR_IP = '203.0.113.42';
const UNRECOGNIZED = 'Would my grandmother Edith enjoy his talk on monads?';

/** Everything the server writes to stdout and stderr, one parsed line each. */
function captureLogs() {
  const lines: string[] = [];
  const capture = (line: unknown) => lines.push(String(line));
  vi.spyOn(console, 'log').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
  return {
    lines,
    records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

async function ask(handle: (request: Request) => Promise<Response>, message: string) {
  const response = await handle(
    new Request('https://marciomariani.dev/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': VISITOR_IP },
      body: JSON.stringify({ message }),
    }),
  );
  await response.text();
  return response;
}

beforeEach(() => {
  // No credential: every question stays in-process, as on a site without a key.
  vi.stubEnv('OPENAI_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('production logs of a chat request', () => {
  it('records how each question was answered, as one JSON object per line', async () => {
    const logs = captureLogs();
    const handle = createChatHandler(buildContainer());

    await ask(handle, "Tell me about Marcio's career.");
    await ask(handle, UNRECOGNIZED);

    expect(logs.records()).toEqual([
      {
        level: 'info',
        event: 'chat.answered',
        time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) as string,
        path: 'fast',
        outcome: 'answered',
        intent: 'career',
        durationMs: expect.any(Number) as number,
        client: expect.stringMatching(/^[\w-]{16}$/) as string,
      },
      expect.objectContaining({ event: 'chat.answered', path: 'model', outcome: 'unavailable' }),
    ]);
  });

  it('never writes what the visitor asked, nor their address', async () => {
    const logs = captureLogs();
    await ask(createChatHandler(buildContainer()), UNRECOGNIZED);

    const written = logs.lines.join('\n');
    expect(written).not.toContain('Edith');
    expect(written).not.toContain('monads');
    expect(written).not.toContain(VISITOR_IP);
  });

  it('follows one visitor across lines without revealing who they are', async () => {
    const logs = captureLogs();
    const container = buildContainer();
    const handle = createChatHandler({
      ...container,
      requestLimiter: { admit: () => ({ allowed: false, retryAfterMs: 1000 }) },
    });

    await ask(createChatHandler(container), 'hi');
    expect((await ask(handle, 'hi')).status).toBe(429);

    const [answered, limited] = logs.records();
    expect(limited).toMatchObject({ level: 'warn', event: 'chat.rate_limited' });
    expect(limited?.client).toBe(answered?.client);
    expect(logs.lines.join('\n')).not.toContain(VISITOR_IP);
  });
});

describe('limits set by the deployment', () => {
  it('turns visitors away once they pass the request limit in the environment', async () => {
    captureLogs();
    vi.stubEnv('CHAT_REQUESTS_PER_TEN_MINUTES', '2');
    const handle = createChatHandler(buildContainer());

    expect((await ask(handle, 'hi')).status).toBe(200);
    expect((await ask(handle, 'hi')).status).toBe(200);
    expect((await ask(handle, 'hi')).status).toBe(429);
  });
});

describe('the record the container answers from', () => {
  async function answerText(container: ReturnType<typeof buildContainer>, message: string) {
    const response = await createChatHandler(container)(
      new Request('https://portfolio.example/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': VISITOR_IP },
        body: JSON.stringify({ message }),
      }),
    );
    return response.text();
  }

  it('answers from the knowledge it is given, not from a record of its own', async () => {
    captureLogs();
    const fixture = buildContainer({ knowledge: localize(fixtureKnowledge, 'en') });

    const answer = await answerText(fixture, 'Tell me more about Pipewright.');

    expect(answer).toContain('"intent":"project:pipewright"');
    expect(answer).toContain('A small CI runner for monorepos.');
    expect(answer).toContain('Incremental builds over a dependency graph.');
  });

  it("binds the profile's record when given none", async () => {
    captureLogs();

    const answer = await answerText(buildContainer(), 'Tell me more about Pipewright.');

    expect(answer).not.toContain('project:pipewright');
    expect(answer).toContain('"intent":"unknown"');
  });
});
