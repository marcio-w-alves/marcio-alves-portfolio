import OpenAI from 'openai';

/**
 * The one place an OpenAI client is built, so every call it makes is bounded:
 * a provider that hangs must not hold a visitor's request open.
 *
 * `fetch` is the global one, looked up per call. Left alone, the SDK uses its
 * own undici fetch, which bypasses Next.js's fetch instrumentation and every
 * HTTP-level test double — a test once got a real 401 from the API that way.
 */
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    timeout: 20_000,
    maxRetries: 1,
    fetch: (input, init) => globalThis.fetch(input, init),
  });
}
