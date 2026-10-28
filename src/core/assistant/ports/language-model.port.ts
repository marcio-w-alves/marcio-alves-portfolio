export interface ToolCall {
  readonly id: string;
  readonly name: string;
  /** The model's arguments exactly as it wrote them: untrusted, and not necessarily valid JSON. */
  readonly arguments: string;
}

export type ModelMessage =
  | { readonly role: 'system'; readonly content: string }
  | { readonly role: 'user'; readonly content: string }
  | {
      readonly role: 'assistant';
      readonly content: string | null;
      readonly toolCalls?: readonly ToolCall[];
    }
  | { readonly role: 'tool'; readonly toolCallId: string; readonly content: string };

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface ModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Set when the provider reported nothing and the cost was estimated from what was exchanged. */
  readonly estimated?: true;
}

export type ModelEvent =
  | { readonly type: 'text-delta'; readonly delta: string }
  | { readonly type: 'tool-calls'; readonly calls: readonly ToolCall[] }
  | { readonly type: 'finish'; readonly usage: ModelUsage };

export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly tools: readonly ToolDefinition[];
  /** `none` forces a written answer: the last round may not call another action. */
  readonly toolChoice: 'auto' | 'none';
  readonly maxOutputTokens: number;
  readonly signal?: AbortSignal;
}

/** A chat model that can call actions, streamed. */
export interface LanguageModelPort {
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}
