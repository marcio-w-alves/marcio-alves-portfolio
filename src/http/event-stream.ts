import { INTERRUPTED, type AssistantEvent } from '@/core/chat/events';

export const EVENT_STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Proxies that buffer would hold the whole answer back until it is complete.
  'X-Accel-Buffering': 'no',
} as const;

/**
 * Well inside the browser's 30 s idle limit, so one late heartbeat never
 * costs an answer that is still being worked on.
 */
export const HEARTBEAT_INTERVAL_MS = 10_000;

const encoder = new TextEncoder();
// A comment line: every client ignores it, and the bytes keep it from timing out.
const HEARTBEAT = encoder.encode(': keep-alive\n\n');

function frame(event: AssistantEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function isFinal(event: AssistantEvent): boolean {
  return event.type === 'finish' || event.type === 'error';
}

interface Options {
  /** When the answer has taken too long: the visitor is told it was interrupted. */
  readonly deadline?: AbortSignal;
  readonly heartbeatMs?: number;
  /**
   * The visitor went away. Called before the answer is returned, which waits
   * for whatever the answer is awaiting — so this is what stops that call.
   */
  readonly onCancel?: () => void;
}

/**
 * Server-Sent Events, pulled one event at a time: nothing is generated faster
 * than the visitor reads it. When the visitor goes away the stream is
 * cancelled, which ends the generator — and, through the request's abort
 * signal, the model call behind it — so nobody pays for an answer no one is
 * reading.
 *
 * While the next event is being worked on — the model consulting actions
 * before it writes anything — a heartbeat goes out every `heartbeatMs`.
 */
export function eventStream(
  events: AsyncIterable<AssistantEvent>,
  reportError: (error: unknown) => void,
  { deadline, heartbeatMs = HEARTBEAT_INTERVAL_MS, onCancel }: Options = {},
): ReadableStream<Uint8Array> {
  const iterator = events[Symbol.asyncIterator]();
  let ended = false;
  let answered = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const deadlineListener = new AbortController();

  function stop(): void {
    ended = true;
    clearInterval(heartbeat);
    deadlineListener.abort();
  }

  function end(controller: ReadableStreamDefaultController<Uint8Array>, last?: AssistantEvent) {
    stop();
    if (last) controller.enqueue(frame(last));
    controller.close();
  }

  function send(controller: ReadableStreamDefaultController<Uint8Array>, event: AssistantEvent) {
    answered ||= isFinal(event);
    controller.enqueue(frame(event));
  }

  return new ReadableStream({
    start(controller) {
      deadline?.addEventListener(
        'abort',
        () => {
          if (ended) return;
          end(controller, answered ? undefined : INTERRUPTED);
          iterator.return?.().catch(reportError);
        },
        { once: true, signal: deadlineListener.signal },
      );
    },
    async pull(controller) {
      heartbeat = setInterval(() => {
        controller.enqueue(HEARTBEAT);
      }, heartbeatMs);
      try {
        const next = await iterator.next();
        if (ended) return;
        if (next.done) end(controller);
        else send(controller, next.value);
      } catch (error) {
        // After the deadline the visitor has been told; what the answer
        // throws on its way out is the abort it was sent.
        if (ended) return;
        reportError(error);
        end(controller, INTERRUPTED);
      } finally {
        clearInterval(heartbeat);
      }
    },
    async cancel() {
      stop();
      onCancel?.();
      await iterator.return?.();
    },
  });
}
