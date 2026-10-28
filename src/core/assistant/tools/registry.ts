import { z } from 'zod';
import { createDisplayTools } from './display-tools';
import { createKnowledgeTools } from './knowledge-tools';
import { defineTool, type Tool, type ToolFailure, type ToolOutcome } from './tool';

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
  run(name: string, rawArguments: unknown, signal?: AbortSignal): Promise<ToolOutcome>;
}

interface RegistryOptions {
  /** Actions beyond the built-in ones, such as those that reach the network. */
  readonly extra?: readonly Tool[];
  /** Told of every action that throws, with what it threw; the model is never shown that. */
  readonly reportError: (failure: ToolFailure) => void;
}

function failed(name: string): ToolOutcome {
  return {
    ok: false,
    error: `The action failed: "${name}" could not run right now. Answer from the other actions, or decline.`,
  };
}

/**
 * The complete allow-list. A name outside it is an error returned to the
 * model, never executed. An action that throws becomes an error the model can
 * answer around, so one broken action never costs the visitor the answer.
 */
export function createToolRegistry({ extra = [], reportError }: RegistryOptions): ToolRegistry {
  const tools = [...createKnowledgeTools(), ...createDisplayTools(), declineToAnswer, ...extra];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  if (byName.size !== tools.length) throw new Error('Two tools share a name.');
  return {
    tools,
    async run(name, rawArguments, signal) {
      const tool = byName.get(name);
      if (!tool)
        return { ok: false, error: `Unknown action "${name}". Use only the listed actions.` };
      try {
        return await tool.run(rawArguments, signal);
      } catch (error) {
        // The visitor left: there is no answer left to save, and nothing failed.
        if (signal?.aborted) throw error;
        reportError({ tool: name, error });
        return failed(name);
      }
    },
  };
}
