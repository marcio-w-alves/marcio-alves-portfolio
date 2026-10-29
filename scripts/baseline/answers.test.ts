import { readdir } from 'node:fs/promises';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { captureAnswers } from './answers';
import { captureFiles } from './capture-layout';
import type { AnswerInput } from './inputs';
import { REMOTE_CHAT_INTERVAL_MS, type Clock } from './pacing';
import { readJson } from './private-files';
import { scratchDir } from './testing/tool';

/**
 * The chat endpoint is the network boundary: MSW answers it, here for the
 * deployed site and for a local server, and records when each question
 * arrived on an injected clock.
 */

const REMOTE = new URL('https://portfolio.example');
const LOCAL = new URL('http://localhost:3200');

const questions: AnswerInput[] = ['Where does she work?', 'What has she led?', 'Which stack?'].map(
  (message, index) => ({
    id: `en/overview/-/-/q${String(index)}`,
    origin: 'topic',
    locale: 'en',
    message,
    context: { topic: 'overview', lastIntent: null, ctaShown: false },
  }),
);

const STREAM = [
  { type: 'start', intent: 'career', related: null },
  { type: 'text-start', id: 'p0' },
  { type: 'text-delta', id: 'p0', delta: 'Principal ' },
  { type: 'text-delta', id: 'p0', delta: 'Platform Engineer.' },
  { type: 'text-end', id: 'p0' },
  {
    type: 'finish',
    followUps: ['What has she led?'],
    sources: [{ id: 'career', label: 'Career' }],
  },
];

function eventStream(events: readonly unknown[] = STREAM): HttpResponse<string> {
  const frames = events.map((event) => `data: ${JSON.stringify(event)}\n\n`);
  return new HttpResponse(`: keep-alive\n\n${frames.join('')}`, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  });
}

function fakeClock() {
  let now = 0;
  const sleeps: number[] = [];
  const clock: Clock = {
    now: () => now,
    sleep: (ms) => {
      sleeps.push(ms);
      now += ms;
      return Promise.resolve();
    },
  };
  return { clock, sleeps };
}

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

interface Arrival {
  readonly at: number;
  readonly message: string;
}

function answeringAt(target: URL, clock: Clock, arrivals: Arrival[]) {
  return http.post(new URL('/api/chat', target).href, async ({ request }) => {
    const { message } = (await request.json()) as { message: string };
    arrivals.push({ at: clock.now(), message });
    return eventStream();
  });
}

describe('asking the chat endpoint', () => {
  it('waits at least 15 s between questions to the deployed site', async () => {
    const { clock } = fakeClock();
    const arrivals: Arrival[] = [];
    network.use(answeringAt(REMOTE, clock, arrivals));

    await captureAnswers(questions, { target: REMOTE, dir: scratch.path, clock });

    const gaps = arrivals.slice(1).map(({ at }, index) => at - (arrivals[index]?.at ?? 0));
    expect(arrivals).toHaveLength(3);
    expect(gaps.every((gap) => gap >= REMOTE_CHAT_INTERVAL_MS)).toBe(true);
  });

  it('asks a local server without waiting', async () => {
    const { clock, sleeps } = fakeClock();
    const arrivals: Arrival[] = [];
    network.use(answeringAt(LOCAL, clock, arrivals));

    await captureAnswers(questions, { target: LOCAL, dir: scratch.path, clock });

    expect(arrivals).toHaveLength(3);
    expect(sleeps).toEqual([]);
  });

  it('keeps the answer the stream adds up to', async () => {
    const { clock } = fakeClock();
    network.use(answeringAt(LOCAL, clock, []));

    await captureAnswers(questions.slice(0, 1), { target: LOCAL, dir: scratch.path, clock });

    const [file = ''] = await readdir(captureFiles(scratch.path).answers);
    await expect(readJson(`${captureFiles(scratch.path).answers}/${file}`)).resolves.toEqual({
      asked: questions[0],
      observed: {
        status: 200,
        intent: 'career',
        related: null,
        parts: [{ type: 'text', text: 'Principal Platform Engineer.' }],
        followUps: ['What has she led?'],
        sources: [{ id: 'career', label: 'Career' }],
      },
    });
  });

  it('keeps an event of a type it does not know, so a new kind of event is still compared', async () => {
    const { clock } = fakeClock();
    const unknown = { type: 'citation-preview', id: 'c0', url: 'https://ada.example/talk' };
    network.use(
      http.post(new URL('/api/chat', LOCAL).href, () => eventStream([...STREAM, unknown])),
    );

    await captureAnswers(questions.slice(0, 1), { target: LOCAL, dir: scratch.path, clock });

    const [file = ''] = await readdir(captureFiles(scratch.path).answers);
    await expect(readJson(`${captureFiles(scratch.path).answers}/${file}`)).resolves.toMatchObject({
      observed: { unknownEvents: [unknown] },
    });
  });

  it('resumes an interrupted capture without asking again what it already has', async () => {
    const { clock } = fakeClock();
    const arrivals: Arrival[] = [];
    network.use(
      http.post(new URL('/api/chat', REMOTE).href, async ({ request }) => {
        const { message } = (await request.json()) as { message: string };
        return message === questions[2]?.message ? HttpResponse.error() : eventStream();
      }),
    );
    await expect(
      captureAnswers(questions, { target: REMOTE, dir: scratch.path, clock }),
    ).rejects.toThrow();
    network.resetHandlers(answeringAt(REMOTE, clock, arrivals));

    await captureAnswers(questions, { target: REMOTE, dir: scratch.path, clock });

    expect(arrivals.map(({ message }) => message)).toEqual([questions[2]?.message]);
    expect(await readdir(captureFiles(scratch.path).answers)).toHaveLength(3);
  });

  it('waits out a refusal for as long as the site asks, then asks again', async () => {
    const { clock, sleeps } = fakeClock();
    let refused = false;
    network.use(
      http.post(new URL('/api/chat', LOCAL).href, () => {
        if (refused) return eventStream();
        refused = true;
        return HttpResponse.json(
          { error: 'rate_limited' },
          { status: 429, headers: { 'Retry-After': '42' } },
        );
      }),
    );

    await captureAnswers(questions.slice(0, 1), { target: LOCAL, dir: scratch.path, clock });

    expect(sleeps).toEqual([42_000]);
    expect(await readdir(captureFiles(scratch.path).answers)).toHaveLength(1);
  });
});
