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
 */
export function createOpenAILanguageModel({
  client,
  model,
  temperature,
}: Options): LanguageModelPort {
  return {
    async *stream({ messages, tools, toolChoice, maxOutputTokens, signal }) {
      const stream = await client.chat.completions.create(
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
        signal ? { signal } : undefined,
      );

      const calls = new Map<number, ToolCall>();
      let usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };
      for await (const chunk of stream) {
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
      if (calls.size > 0) {
        yield {
          type: 'tool-calls',
          calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call),
        };
      }
      yield { type: 'finish', usage };
    },
  };
}
