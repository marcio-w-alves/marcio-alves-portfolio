import {
  INTERRUPTED,
  isAssistantEvent,
  type AssistantError,
  type AssistantEvent,
} from '@/core/chat/events';
import type { ChatRequest } from '@/core/chat/request';
import { createSseParser } from './sse-parser';

interface Options {
  readonly signal: AbortSignal;
  readonly endpoint?: string;
  /** How long the stream may stay silent before the answer counts as lost. */
  readonly idleTimeoutMs?: number;
}

const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

const UNREACHABLE: AssistantError = { code: 'network', retryable: true };
const TIMED_OUT: AssistantError = { code: 'timeout', retryable: true };

function rateLimited(retryAfter: string | null): AssistantError {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0
    ? { code: 'rate_limited', retryable: true, retryAfterSeconds: seconds }
    : { code: 'rate_limited', retryable: true };
}

function rejected(status: number): AssistantError {
  return status === 413 || status === 400
    ? { code: 'rejected', retryable: false }
    : { code: 'internal', retryable: true };
}

/** The stream comes from our own server, but it is still parsed, not trusted. */
function parseEvent(data: string): AssistantEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    return isAssistantEvent(value) ? value : null;
  } catch {
    return null;
  }
}

/** Each frame's data, from a byte stream; `onChunk` hears every read, heartbeats included. */
async function* frames(body: ReadableStream<Uint8Array>, onChunk: () => void) {
  const reader = body.getReader();
  const parser = createSseParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk();
      yield* parser.push(value);
    }
    yield* parser.end();
  } finally {
    reader.releaseLock();
  }
}

// A relative endpoint is resolved against the page, as a browser would;
// runtimes without a page (Node, tests) need the absolute one.
function resolve(endpoint: string): string {
  return typeof window === 'undefined' ? endpoint : new URL(endpoint, window.location.href).href;
}

/**
 * Asks `/api/chat` and yields its events. Never throws: a failure arrives as
 * a final `error` event the conversation can show and offer to retry. When
 * the visitor stops the answer (`signal` aborts) it simply ends.
 */
export async function* streamAnswer(
  request: ChatRequest,
  { signal, endpoint = '/api/chat', idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS }: Options,
): AsyncGenerator<AssistantEvent> {
  const idle = new AbortController();
  let timer = setTimeout(() => {
    idle.abort();
  }, idleTimeoutMs);
  const restartIdleTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      idle.abort();
    }, idleTimeoutMs);
  };

  try {
    const response = await fetch(resolve(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal: AbortSignal.any([signal, idle.signal]),
    });
    if (response.status === 429) {
      yield { type: 'error', error: rateLimited(response.headers.get('Retry-After')) };
      return;
    }
    if (!response.ok || !response.body) {
      yield { type: 'error', error: rejected(response.status) };
      return;
    }

    for await (const data of frames(response.body, restartIdleTimer)) {
      const event = parseEvent(data);
      if (!event) continue;
      yield event;
      if (event.type === 'finish' || event.type === 'error') return;
    }
    yield INTERRUPTED;
  } catch {
    if (signal.aborted) return;
    yield { type: 'error', error: idle.signal.aborted ? TIMED_OUT : UNREACHABLE };
  } finally {
    clearTimeout(timer);
  }
}
