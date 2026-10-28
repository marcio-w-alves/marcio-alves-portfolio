import type OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type {
  LanguageModelPort,
  ModelMessage,
  ModelUsage,
  ToolCall,
} from '@/core/assistant/ports/language-model.port';

interface Options {
  readonly client: OpenAI;
  readonly model: string;
  readonly temperature: number;
  /** How long the stream may go without a chunk before the call is given up. */
  readonly idleTimeoutMs: number;
}

export class ModelStreamStalledError extends Error {
  constructor(idleTimeoutMs: number) {
    super(`The model stream sent nothing for ${String(idleTimeoutMs)} ms and was abandoned.`);
    this.name = 'ModelStreamStalledError';
  }
}

/**
 * Calls `onIdle` when the source keeps the consumer waiting longer than
 * `idleMs` for the next item. Time the consumer spends with an item does not
 * count: a visitor reading slowly is not a stalled provider.
 */
async function* abortWhenIdle<T>(
  source: AsyncIterable<T>,
  idleMs: number,
  onIdle: () => void,
): AsyncGenerator<T> {
  let timer = setTimeout(onIdle, idleMs);
  try {
    for await (const item of source) {
      clearTimeout(timer);
      yield item;
      timer = setTimeout(onIdle, idleMs);
    }
  } finally {
    clearTimeout(timer);
  }
}

function toOpenAI(message: ModelMessage): ChatCompletionMessageParam {
  switch (message.role) {
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: 'function' as const,
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : {}),
      };
    case 'tool':
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    default:
      return { role: message.role, content: message.content };
  }
}

/**
 * Chat completions, streamed. Tool calls arrive as fragments spread over many
 * chunks — the name once, the arguments a few characters at a time — keyed by
 * index, so they are assembled here and handed over whole.
 *
 * The SDK's timeout ends once the response headers arrive, and an aborted
 * stream just ends, as if the answer were complete. Both are made explicit
 * here: a stream that goes quiet is abandoned and fails, and a cancelled one
 * fails as cancelled, so nobody mistakes half an answer for a whole one.
 */
export function createOpenAILanguageModel({
  client,
  model,
  temperature,
  idleTimeoutMs,
}: Options): LanguageModelPort {
  return {
    async *stream({ messages, tools, toolChoice, maxOutputTokens, signal }) {
      const stall = new AbortController();
      const stream = await client.chat.completions
        .create(
          {
            model,
            temperature,
            stream: true,
            stream_options: { include_usage: true },
            max_completion_tokens: maxOutputTokens,
            messages: messages.map(toOpenAI),
            tools: tools.map((tool) => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: { ...tool.parameters },
              },
            })),
            tool_choice: toolChoice,
          },
          { signal: signal ? AbortSignal.any([signal, stall.signal]) : stall.signal },
        )
        .catch((error: unknown) => {
          // The SDK reports a visitor leaving before the headers as a generic
          // error; throw it as the abort it is, so it is not the provider's fault.
          signal?.throwIfAborted();
          throw error;
        });

      yield { type: 'started' };

      const calls = new Map<number, ToolCall>();
      let usage: ModelUsage | undefined;
      const chunks = abortWhenIdle(stream, idleTimeoutMs, () => {
        stall.abort();
      });
      for await (const chunk of chunks) {
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          };
        }
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) yield { type: 'text-delta', delta: delta.content };
        for (const fragment of delta?.tool_calls ?? []) {
          const current = calls.get(fragment.index) ?? { id: '', name: '', arguments: '' };
          calls.set(fragment.index, {
            id: fragment.id ?? current.id,
            name: current.name + (fragment.function?.name ?? ''),
            arguments: current.arguments + (fragment.function?.arguments ?? ''),
          });
        }
      }
      signal?.throwIfAborted();
      if (stall.signal.aborted) throw new ModelStreamStalledError(idleTimeoutMs);
      if (calls.size > 0) {
        yield {
          type: 'tool-calls',
          calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call),
        };
      }
      if (usage) yield { type: 'finish', usage };
    },
  };
}
