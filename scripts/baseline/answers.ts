import { join } from 'node:path';
import { captureFiles, fileOf, idsIn } from './capture-layout';
import type { AnswerInput } from './inputs';
import { chatIntervalFor, createPacer, type Clock } from './pacing';
import { writePrivateJson } from './private-files';

/**
 * Asks the site's chat endpoint every fast-path question, as the interface
 * does, and keeps the final answer each stream adds up to. Timings and the
 * stream's chunking are not kept: they are not the answer.
 */

export type AnswerPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'component'; readonly component: string; readonly props: unknown };

export interface ObservedAnswer {
  readonly status: number;
  readonly intent?: string;
  readonly related?: unknown;
  readonly parts?: readonly AnswerPart[];
  readonly followUps?: readonly string[];
  readonly sources?: readonly unknown[];
  readonly error?: unknown;
  /** What a refused request said instead of streaming. */
  readonly body?: string;
}

export interface CapturedAnswer {
  readonly asked: AnswerInput;
  readonly observed: ObservedAnswer;
}

interface AnswerCaptureOptions {
  readonly target: URL;
  readonly dir: string;
  readonly clock: Clock;
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_AFTER_S = 60;

export class ChatRefusedError extends Error {
  constructor(id: string, attempts: number) {
    super(
      `The chat endpoint kept answering 429 to ${id} after ${String(attempts)} attempts. ` +
        'Run the capture again later: it resumes where it stopped.',
    );
    this.name = 'ChatRefusedError';
  }
}

/** Asks every question not captured yet; what an earlier run captured is kept. */
export async function captureAnswers(
  inputs: readonly AnswerInput[],
  { target, dir, clock }: AnswerCaptureOptions,
): Promise<void> {
  const folder = captureFiles(dir).answers;
  const captured = new Set(await idsIn(folder, '.json'));
  const pace = createPacer(chatIntervalFor(target), clock);
  for (const asked of inputs) {
    if (captured.has(asked.id)) continue;
    const observed = await askUntilAdmitted(asked, target, pace, clock);
    await writePrivateJson(join(folder, fileOf(asked.id, '.json')), { asked, observed });
  }
}

async function askUntilAdmitted(
  asked: AnswerInput,
  target: URL,
  pace: () => Promise<void>,
  clock: Clock,
): Promise<ObservedAnswer> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await pace();
    const response = await postQuestion(asked, target);
    if (response.status !== 429) return observe(response);
    await response.body?.cancel();
    await clock.sleep(retryAfterMs(response));
  }
  throw new ChatRefusedError(asked.id, MAX_ATTEMPTS);
}

function postQuestion({ message, context, locale }: AnswerInput, target: URL): Promise<Response> {
  return fetch(new URL('/api/chat', target), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, history: [], context, locale }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_S) * 1000;
}

async function observe(response: Response): Promise<ObservedAnswer> {
  const text = await response.text();
  if (response.status !== 200) return { status: response.status, body: text };
  return { status: response.status, ...foldEvents(eventsIn(text)) };
}

type StreamEvent = Readonly<Record<string, unknown>> & { readonly type: string };

/** The JSON of every `data:` line of a Server-Sent Events body; heartbeats are comments. */
function eventsIn(body: string): StreamEvent[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice('data: '.length)) as StreamEvent);
}

/** The answer a stream adds up to, the way the interface assembles it. */
function foldEvents(events: readonly StreamEvent[]): Omit<ObservedAnswer, 'status'> {
  const parts: AnswerPart[] = [];
  const textAt = new Map<unknown, number>();
  let answer: Omit<ObservedAnswer, 'status' | 'parts'> = {};
  for (const event of events) {
    switch (event.type) {
      case 'start':
        answer = { ...answer, intent: String(event.intent), related: event.related };
        break;
      case 'text-start':
        textAt.set(event.id, parts.push({ type: 'text', text: '' }) - 1);
        break;
      case 'text-delta':
        appendText(parts, textAt.get(event.id), String(event.delta));
        break;
      case 'component':
        parts.push({ type: 'component', component: String(event.component), props: event.props });
        break;
      case 'finish':
        answer = {
          ...answer,
          followUps: event.followUps as readonly string[],
          sources: event.sources as readonly unknown[],
        };
        break;
      case 'error':
        answer = { ...answer, error: event.error };
        break;
    }
  }
  return { ...answer, parts };
}

function appendText(parts: AnswerPart[], index: number | undefined, delta: string): void {
  const part = index === undefined ? undefined : parts[index];
  if (index !== undefined && part?.type === 'text')
    parts[index] = { ...part, text: part.text + delta };
}
