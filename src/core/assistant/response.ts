import type { AnswerSource, AssistantEvent, RelatedRole } from '../chat/events';
import type { ResponsePart } from '../chat/components';

/**
 * A complete answer, before it is streamed. Both the deterministic fast path
 * and the model-backed path produce this same shape, so the interface never
 * knows which one answered.
 */
export interface AssistantResponse {
  readonly intent: string;
  readonly parts: readonly ResponsePart[];
  readonly followUps: readonly string[];
  readonly sources: readonly AnswerSource[];
  readonly related: RelatedRole | null;
  /** False when the answer is a refusal or a gap rather than documented fact. */
  readonly grounded: boolean;
}

/** One delta per text part; the transport is free to re-chunk them for pacing. */
export function toEvents(response: AssistantResponse): AssistantEvent[] {
  const events: AssistantEvent[] = [
    { type: 'start', intent: response.intent, related: response.related },
  ];
  response.parts.forEach((part, index) => {
    const id = `p${String(index)}`;
    if (part.type === 'text') {
      events.push(
        { type: 'text-start', id },
        { type: 'text-delta', id, delta: part.text },
        { type: 'text-end', id },
      );
    } else {
      const { type: _part, ...component } = part;
      events.push({ type: 'component', id, ...component });
    }
  });
  events.push({ type: 'finish', followUps: response.followUps, sources: response.sources });
  return events;
}
