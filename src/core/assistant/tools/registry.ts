import { z } from 'zod';
import { createDisplayTools } from './display-tools';
import { createKnowledgeTools } from './knowledge-tools';
import { defineTool, type Tool, type ToolOutcome } from './tool';

/**
 * Declining is an action like any other, so an answer that falls outside what
 * Marcio documented is recorded as such — measurably — instead of being
 * indistinguishable from a grounded one.
 */
const declineToAnswer = defineTool({
  name: 'declineToAnswer',
  description:
    'Record that the question cannot be answered from the documented record: it is not documented, off-topic, or private. Call it before writing the reply that says so.',
  input: { reason: z.enum(['not_documented', 'off_topic', 'private']) },
  execute: ({ reason }) => ({
    data: { recorded: reason },
    sources: [],
    effect: { kind: 'decline', reason },
  }),
});

export interface ToolRegistry {
  readonly tools: readonly Tool[];
  run(name: string, rawArguments: unknown): Promise<ToolOutcome>;
}

/** The complete allow-list. A name outside it is an error returned to the model, never executed. */
export function createToolRegistry(extra: readonly Tool[] = []): ToolRegistry {
  const tools = [...createKnowledgeTools(), ...createDisplayTools(), declineToAnswer, ...extra];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  if (byName.size !== tools.length) throw new Error('Two tools share a name.');
  return {
    tools,
    async run(name, rawArguments) {
      const tool = byName.get(name);
      if (!tool)
        return { ok: false, error: `Unknown action "${name}". Use only the listed actions.` };
      return tool.run(rawArguments);
    },
  };
}
