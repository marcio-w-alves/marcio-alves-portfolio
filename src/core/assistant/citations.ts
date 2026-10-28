import type { SourceId } from '@/core/knowledge/ids';
import { sourceLabel } from '@/core/knowledge/knowledge-base';
import type { AnswerSource } from './assistant-event';

/** How an answer credits the knowledge-base record it was built from. */
export function citation(id: SourceId): AnswerSource {
  return { id, label: sourceLabel(id) };
}
