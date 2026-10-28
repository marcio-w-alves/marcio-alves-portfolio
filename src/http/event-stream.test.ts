import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INTERRUPTED, type AssistantEvent } from '@/core/chat/events';
import { eventStream } from './event-stream';

const START: AssistantEvent = { type: 'start', intent: 'model', related: null };
const TEXT: AssistantEvent = { type: 'text-start', id: 'p0' };
const FINISH: AssistantEvent = { type: 'finish', followUps: [], sources: [] };
const HEARTBEAT = ': keep-alive\n\n';
const HEARTBEAT_MS = 10_000;

const frame = (event: AssistantEvent) => `data: ${JSON.stringify(event)}\n\n`;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Reads the whole stream in the background, keeping every chunk as it arrives. */
function readAll(stream: ReadableStream<Uint8Array>) {
  const received: string[] = [];
  const decoder = new TextDecoder();
  const closed = (async () => {
    for await (const chunk of stream) received.push(decoder.decode(chunk));
  })();
  return { received, closed };
}

/** Settles only when the signal aborts, the way a signal-aware model call does. */
function untilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(signal.reason as Error);
    });
  });
}

const noErrors = () => {
  throw new Error('nothing should be reported');
};

describe('the event stream while an answer is slow', () => {
  it('keeps a waiting stream alive with heartbeats, and only while it waits', async () => {
    const firstWait = Promise.withResolvers<AssistantEvent>();
    const secondWait = Promise.withResolvers<AssistantEvent>();
    async function* answer() {
      yield START;
      yield await firstWait.promise;
      yield await secondWait.promise;
    }
    const { received, closed } = readAll(
      eventStream(answer(), noErrors, { heartbeatMs: HEARTBEAT_MS }),
    );

    await vi.advanceTimersByTimeAsync(40_000);
    expect(received).toEqual([frame(START), ...Array<string>(4).fill(HEARTBEAT)]);

    firstWait.resolve(TEXT);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS - 1);
    expect(received.slice(5)).toEqual([frame(TEXT)]);

    await vi.advanceTimersByTimeAsync(1);
    expect(received.slice(5)).toEqual([frame(TEXT), HEARTBEAT]);

    secondWait.resolve(FINISH);
    await closed;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(received.slice(5)).toEqual([frame(TEXT), HEARTBEAT, frame(FINISH)]);
  });

  it('sends a heartbeat at least every fifteen seconds by default', async () => {
    async function* answer() {
      yield await new Promise<AssistantEvent>(() => undefined);
    }
    const { received } = readAll(eventStream(answer(), noErrors));

    await vi.advanceTimersByTimeAsync(15_000);
    expect(received).toContain(HEARTBEAT);
  });
});

describe('the event stream at the time limit', () => {
  it('ends the stream with the interrupted event when the deadline passes', async () => {
    const deadline = new AbortController();
    let generatorFinished = false;
    async function* answer() {
      try {
        yield START;
        yield await untilAborted(deadline.signal);
      } finally {
        generatorFinished = true;
      }
    }
    const { received, closed } = readAll(
      eventStream(answer(), noErrors, { deadline: deadline.signal }),
    );
    await vi.advanceTimersByTimeAsync(0);

    deadline.abort(new DOMException('Too long', 'AbortError'));
    await closed;

    expect(received).toEqual([frame(START), frame(INTERRUPTED)]);
    expect(generatorFinished).toBe(true);
  });

  it('ends the stream at the deadline even while nobody is reading', async () => {
    const deadline = new AbortController();
    async function* answer() {
      yield START;
      yield await untilAborted(deadline.signal);
    }
    const stream = eventStream(answer(), noErrors, { deadline: deadline.signal });
    await vi.advanceTimersByTimeAsync(0);

    deadline.abort(new DOMException('Too long', 'AbortError'));
    const { received, closed } = readAll(stream);
    await closed;

    expect(received).toEqual([frame(START), frame(INTERRUPTED)]);
  });

  it('adds nothing once the answer has finished', async () => {
    const deadline = new AbortController();
    async function* answer() {
      yield FINISH;
      await untilAborted(deadline.signal);
    }
    const { received, closed } = readAll(
      eventStream(answer(), noErrors, { deadline: deadline.signal }),
    );
    await vi.advanceTimersByTimeAsync(0);

    deadline.abort(new DOMException('Too long', 'AbortError'));
    await closed;

    expect(received).toEqual([frame(FINISH)]);
  });
});

describe('the event stream when the answer ends early', () => {
  it('ends with the interrupted event, and reports the error, when the answer breaks', async () => {
    const failure = new Error('bug');
    const reported: unknown[] = [];
    async function* answer() {
      yield START;
      await Promise.resolve();
      throw failure;
    }
    const { received, closed } = readAll(eventStream(answer(), (error) => reported.push(error)));
    await closed;

    expect(received).toEqual([frame(START), frame(INTERRUPTED)]);
    expect(reported).toEqual([failure]);
  });

  it('tells the answer the visitor left before waiting for it to stop', async () => {
    const visitor = new AbortController();
    let generatorFinished = false;
    async function* answer() {
      try {
        yield START;
        yield await untilAborted(visitor.signal);
      } finally {
        generatorFinished = true;
      }
    }
    const reader = eventStream(answer(), noErrors, {
      onCancel: () => {
        visitor.abort(new DOMException('Left', 'AbortError'));
      },
    }).getReader();
    await reader.read();
    await vi.advanceTimersByTimeAsync(0);

    await reader.cancel();

    expect(visitor.signal.aborted).toBe(true);
    expect(generatorFinished).toBe(true);
  });

  it('returns the answer and sends nothing more when the visitor leaves', async () => {
    let generatorFinished = false;
    async function* answer() {
      try {
        for (;;) yield await Promise.resolve(TEXT);
      } finally {
        generatorFinished = true;
      }
    }
    const reader = eventStream(answer(), noErrors).getReader();
    await reader.read();

    await reader.cancel();

    expect(generatorFinished).toBe(true);
    expect(await reader.read()).toEqual({ done: true, value: undefined });
  });
});
