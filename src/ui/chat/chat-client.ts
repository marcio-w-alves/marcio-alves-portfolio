import type { AssistantError, AssistantEvent } from '@/core/assistant/assistant-event';
import type { ConversationContext } from '@/core/assistant/response';
import type { HistoryTurn } from '@/core/conversation/messages';

export interface ChatRequest {
  readonly message: string;
  readonly history: readonly HistoryTurn[];
  readonly context: ConversationContext;
}

interface Options {
  readonly signal: AbortSignal;
  readonly endpoint?: string;
  /** How long the stream may stay silent before the answer counts as lost. */
  readonly idleTimeoutMs?: number;
}

const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

const UNREACHABLE: AssistantError = {
  code: 'network',
  message: "The assistant couldn't be reached. Check your connection and try again.",
  retryable: true,
};

const TIMED_OUT: AssistantError = {
  code: 'timeout',
  message: 'The answer is taking too long. Please try again.',
  retryable: true,
};

const INTERRUPTED: AssistantError = {
  code: 'internal',
  message: 'The answer was interrupted. Please try again.',
  retryable: true,
};

function rateLimited(retryAfter: string | null): AssistantError {
  const minutes = Math.ceil(Number(retryAfter) / 60);
  const wait =
    Number.isFinite(minutes) && minutes > 0
      ? `Try again in ${String(minutes)} minute${minutes > 1 ? 's' : ''}.`
      : 'Try again in a few minutes.';
  return {
    code: 'rate_limited',
    message: `Too many questions in a short time. ${wait}`,
    retryable: true,
  };
}

function rejected(status: number): AssistantError {
  return status === 413 || status === 400
    ? {
        code: 'internal',
        message: 'That question could not be sent. Try a shorter one.',
        retryable: false,
      }
    : {
        code: 'internal',
        message: 'Something failed on our side. Please try again.',
        retryable: true,
      };
}

const EVENT_TYPES = new Set([
  'start',
  'text-start',
  'text-delta',
  'text-end',
  'component',
  'finish',
  'error',
]);

/** The stream comes from our own server, but it is still parsed, not trusted. */
function parseEvent(data: string): AssistantEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    if (typeof value !== 'object' || value === null || !('type' in value)) return null;
    return typeof value.type === 'string' && EVENT_TYPES.has(value.type)
      ? (value as AssistantEvent)
      : null;
  } catch {
    return null;
  }
}

/** Splits Server-Sent Events frames out of a byte stream, `data:` lines only. */
async function* frames(body: ReadableStream<Uint8Array>, onChunk: () => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk();
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const data = part
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('');
        if (data) yield data;
      }
    }
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
    yield { type: 'error', error: INTERRUPTED };
  } catch {
    if (signal.aborted) return;
    yield { type: 'error', error: idle.signal.aborted ? TIMED_OUT : UNREACHABLE };
  } finally {
    clearTimeout(timer);
  }
}
