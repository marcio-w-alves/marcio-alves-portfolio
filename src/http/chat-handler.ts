import { z } from 'zod';
import type { Assistant } from '@/core/assistant/assistant';
import { chatRequestSchema } from '@/core/chat/request-schema';
import { clientIdOf } from './client-key';
import { EVENT_STREAM_HEADERS, eventStream } from './event-stream';

/** Generous for twelve turns of history, far short of anything abusive. */
export const MAX_BODY_BYTES = 32_768;

function problem(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** Reads the body in pieces and stops at the cap: a Content-Length can lie. */
async function readBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * The exact type, not a mention of it: `text/plain; application/json` is a
 * simple type a cross-site form or fetch sends without a CORS preflight.
 */
function isJson(contentType: string | null): boolean {
  return contentType?.split(';')[0]?.trim().toLowerCase() === 'application/json';
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Paces requests per client; the composition root supplies the implementation. */
interface RequestLimiter {
  admit(clientId: string): { readonly allowed: boolean; readonly retryAfterMs: number };
}

interface Dependencies {
  readonly assistant: Assistant;
  readonly reportError: (error: unknown) => void;
  readonly requestLimiter: RequestLimiter;
  readonly reportRateLimited: (clientId: string) => void;
  /** The longest an answer may take before it ends as interrupted. */
  readonly requestTimeoutMs: number;
}

/**
 * Aborts as a cancellation, not as a timeout: an answer out of time says
 * nothing about the health of the model or the search behind it, so it must
 * not count against their circuit breakers.
 */
function deadlineAfter(ms: number): AbortSignal {
  const deadline = new AbortController();
  AbortSignal.timeout(ms).addEventListener(
    'abort',
    () => {
      deadline.abort(new DOMException('The answer ran out of time.', 'AbortError'));
    },
    { once: true },
  );
  return deadline.signal;
}

/**
 * Aborts when the visitor goes away. The request's own signal is not enough:
 * undici forwards an abort to it only while the platform still holds the
 * Request, so the stream also aborts this when its reader cancels.
 */
function visitorOf(request: Request): AbortController {
  const visitor = new AbortController();
  request.signal.addEventListener(
    'abort',
    () => {
      visitor.abort(request.signal.reason);
    },
    { once: true, signal: visitor.signal },
  );
  return visitor;
}

export function createChatHandler({
  assistant,
  reportError,
  requestLimiter,
  reportRateLimited,
  requestTimeoutMs,
}: Dependencies) {
  return async function handle(request: Request): Promise<Response> {
    const clientId = clientIdOf(request);
    // Checked before the body is read, so a flood costs as little as possible.
    const admission = requestLimiter.admit(clientId);
    if (!admission.allowed) {
      reportRateLimited(clientId);
      return Response.json(
        { error: { code: 'rate_limited', message: 'Too many questions in a short time.' } },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(admission.retryAfterMs / 1000)) },
        },
      );
    }
    // Browsers send it on every fetch; only a browser can be made to ask on
    // another site's behalf, and its visitors' addresses would dodge the limits.
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite !== null && fetchSite !== 'same-origin') {
      return problem(403, 'cross_site', 'Ask from the site itself.');
    }
    if (!isJson(request.headers.get('content-type'))) {
      return problem(415, 'unsupported_media_type', 'Send the question as application/json.');
    }
    const text = await readBody(request);
    if (text === null) return problem(413, 'too_large', 'The request is too large.');

    const parsed = chatRequestSchema.safeParse(parseJson(text));
    if (!parsed.success) {
      return problem(400, 'invalid_request', z.prettifyError(parsed.error));
    }

    const { message, history, context } = parsed.data;
    const visitor = visitorOf(request);
    const deadline = deadlineAfter(requestTimeoutMs);
    const events = assistant.answer(
      { question: message, history, context, clientId },
      { visitor: visitor.signal, deadline },
    );
    const leave = () => {
      visitor.abort(new DOMException('The visitor left.', 'AbortError'));
    };
    return new Response(eventStream(events, reportError, { deadline, onCancel: leave }), {
      headers: EVENT_STREAM_HEADERS,
    });
  };
}
