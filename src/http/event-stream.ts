import { INTERRUPTED, type AssistantEvent } from '@/core/chat/events';

export const EVENT_STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Proxies that buffer would hold the whole answer back until it is complete.
  'X-Accel-Buffering': 'no',
} as const;

function frame(event: AssistantEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Server-Sent Events, pulled one event at a time: nothing is generated faster
 * than the visitor reads it. When the visitor goes away the stream is
 * cancelled, which ends the generator — and, through the request's abort
 * signal, the model call behind it — so nobody pays for an answer no one is
 * reading.
 */
export function eventStream(
  events: AsyncIterable<AssistantEvent>,
  reportError: (error: unknown) => void,
): ReadableStream<Uint8Array> {
  const iterator = events[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(frame(next.value));
      } catch (error) {
        reportError(error);
        controller.enqueue(frame(INTERRUPTED));
        controller.close();
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
