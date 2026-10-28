import type { ToolTrace } from '../../src/core/assistant/system2/model-assistant';

/** A cited source must be one the actions handed back, or its evidence was never seen. */
export function sourcesOutsideTrace(
  sources: readonly string[],
  trace: readonly ToolTrace[],
): string[] {
  const returned = new Set(
    trace.flatMap(({ outcome }) => (outcome.ok ? outcome.result.sources.map(({ id }) => id) : [])),
  );
  return sources.filter((id) => !returned.has(id));
}
