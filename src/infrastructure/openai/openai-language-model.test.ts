import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ModelEvent, ModelRequest } from '@/core/assistant/ports/language-model.port';
import { createOpenAIClient } from './openai-client';
import { createOpenAILanguageModel } from './openai-language-model';

const COMPLETIONS = 'https://api.openai.com/v1/chat/completions';
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** The wire format OpenAI streams: one `data:` frame per chunk, then [DONE]. */
function eventStream(chunks: readonly object[]): HttpResponse<ReadableStream> {
  const frames = [
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`),
    'data: [DONE]\n\n',
  ];
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

function chunk(delta: object, finishReason: string | null = null) {
  return {
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gpt-4o-mini',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

const usage = {
  id: 'chatcmpl-1',
  object: 'chat.completion.chunk',
  created: 1,
  model: 'gpt-4o-mini',
  choices: [],
  usage: { prompt_tokens: 120, completion_tokens: 7, total_tokens: 127 },
};

const REQUEST: ModelRequest = {
  messages: [
    { role: 'system', content: 'rules' },
    { role: 'user', content: 'What did he do at Deel?' },
    {
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'call_0', name: 'getSkills', arguments: '{}' }],
    },
    { role: 'tool', toolCallId: 'call_0', content: '{"ok":true}' },
  ],
  tools: [{ name: 'getExperience', description: 'Roles.', parameters: { type: 'object' } }],
  toolChoice: 'none',
  maxOutputTokens: 700,
};

async function events(): Promise<ModelEvent[]> {
  const model = createOpenAILanguageModel({
    client: createOpenAIClient('test-key'),
    model: 'gpt-4o-mini',
    temperature: 0.2,
    idleTimeoutMs: 1000,
  });
  const seen: ModelEvent[] = [];
  for await (const event of model.stream(REQUEST)) seen.push(event);
  return seen;
}

describe('OpenAI language model adapter', () => {
  it('streams text as it arrives and reports usage at the end', async () => {
    server.use(
      http.post(COMPLETIONS, () =>
        eventStream([
          chunk({ role: 'assistant', content: 'He led ' }),
          chunk({ content: 'the HRIS team.' }),
          chunk({}, 'stop'),
          usage,
        ]),
      ),
    );
    expect(await events()).toEqual([
      { type: 'text-delta', delta: 'He led ' },
      { type: 'text-delta', delta: 'the HRIS team.' },
      { type: 'finish', usage: { inputTokens: 120, outputTokens: 7 } },
    ]);
  });

  it('assembles tool calls that arrive in fragments, and keeps them in order', async () => {
    server.use(
      http.post(COMPLETIONS, () =>
        eventStream([
          chunk({
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                type: 'function',
                function: { name: 'getExperience', arguments: '' },
              },
            ],
          }),
          chunk({ tool_calls: [{ index: 0, function: { arguments: '{"comp' } }] }),
          chunk({ tool_calls: [{ index: 0, function: { arguments: 'any":"deel"}' } }] }),
          chunk({
            tool_calls: [
              {
                index: 1,
                id: 'call_2',
                type: 'function',
                function: { name: 'getSkills', arguments: '{}' },
              },
            ],
          }),
          chunk({}, 'tool_calls'),
          usage,
        ]),
      ),
    );
    expect(await events()).toEqual([
      {
        type: 'tool-calls',
        calls: [
          { id: 'call_1', name: 'getExperience', arguments: '{"company":"deel"}' },
          { id: 'call_2', name: 'getSkills', arguments: '{}' },
        ],
      },
      { type: 'finish', usage: { inputTokens: 120, outputTokens: 7 } },
    ]);
  });

  it('sends the conversation, the tools and the limits in OpenAI’s shape', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(COMPLETIONS, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return eventStream([chunk({ content: 'ok' }, 'stop'), usage]);
      }),
    );
    await events();
    expect(body).toMatchObject({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: 700,
      tool_choice: 'none',
      tools: [
        {
          type: 'function',
          function: {
            name: 'getExperience',
            description: 'Roles.',
            parameters: { type: 'object' },
          },
        },
      ],
      messages: [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'What did he do at Deel?' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_0', type: 'function', function: { name: 'getSkills', arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'call_0', content: '{"ok":true}' },
      ],
    });
  });

  it('surfaces a provider failure to the caller', async () => {
    server.use(
      http.post(COMPLETIONS, () =>
        HttpResponse.json({ error: { message: 'stubbed: overloaded' } }, { status: 503 }),
      ),
    );
    await expect(events()).rejects.toThrow('stubbed: overloaded');
  });
});
