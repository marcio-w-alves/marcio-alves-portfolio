import { z } from 'zod';
import type { Assistant } from '@/core/assistant/assistant';
import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import type { Admission } from '@/infrastructure/rate-limit/sliding-window';
import { EVENT_STREAM_HEADERS, eventStream } from './event-stream';

/** Generous for twelve turns of history, far short of anything abusive. */
export const MAX_BODY_BYTES = 32_768;

/**
 * The request the interface sends. Everything in it is untrusted: the
 * context only steers suggestions, and the history only gives the model
 * conversational memory — neither can grant anything.
 */
const chatRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  history: z
    .array(
      z.strictObject({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(4000),
      }),
    )
    .max(24)
    .default([]),
  context: z
    .strictObject({
      topic: z.string().max(40),
      lastIntent: z.string().max(80).nullable(),
      ctaShown: z.boolean(),
    })
    .default({ topic: 'overview', lastIntent: null, ctaShown: false }),
});

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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Vercel sets x-real-ip to the connecting client; x-forwarded-for is the
 * fallback elsewhere. Used only to pace requests, never stored or shown.
 */
function clientIdOf(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  // Blank entries are dropped, so an empty header falls through instead of
  // becoming one key shared by everyone who sends it.
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((entry) => entry.trim())
    .find(Boolean);
  return forwarded ?? 'unknown';
}

interface Dependencies {
  readonly assistant: Assistant;
  readonly reportError: (error: unknown) => void;
  readonly requestLimiter: { admit(key: string): Admission };
}

export function createChatHandler({ assistant, reportError, requestLimiter }: Dependencies) {
  return async function handle(request: Request): Promise<Response> {
    const clientId = clientIdOf(request);
    // Checked before the body is read, so a flood costs as little as possible.
    const admission = requestLimiter.admit(clientId);
    if (!admission.allowed) {
      return Response.json(
        { error: { code: 'rate_limited', message: 'Too many questions in a short time.' } },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(admission.retryAfterMs / 1000)) },
        },
      );
    }
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return problem(415, 'unsupported_media_type', 'Send the question as application/json.');
    }
    const text = await readBody(request);
    if (text === null) return problem(413, 'too_large', 'The request is too large.');

    const parsed = chatRequestSchema.safeParse(parseJson(text));
    if (!parsed.success) {
      return problem(400, 'invalid_request', z.prettifyError(parsed.error));
    }

    const { message, history, context } = parsed.data;
    const events = assistant.answer(
      { question: message, history, context, clientId },
      request.signal,
    );
    return new Response(eventStream(events, reportError), { headers: EVENT_STREAM_HEADERS });
  };
}
