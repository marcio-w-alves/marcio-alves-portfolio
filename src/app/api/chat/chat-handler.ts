import { z } from 'zod';
import type { Assistant } from '@/core/assistant/assistant';
import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
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

interface Dependencies {
  readonly assistant: Assistant;
  readonly reportError: (error: unknown) => void;
}

export function createChatHandler({ assistant, reportError }: Dependencies) {
  return async function handle(request: Request): Promise<Response> {
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
    const events = assistant.answer({ question: message, history, context }, request.signal);
    return new Response(eventStream(events, reportError), { headers: EVENT_STREAM_HEADERS });
  };
}
