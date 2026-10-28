import type { AnswerSource, AssistantEvent } from '../assistant-event';
import type { RichComponent } from '../components';
import type { ClockPort } from '../ports/clock.port';
import type { LanguageModelPort, ModelMessage, ToolCall } from '../ports/language-model.port';
import type { ToolRegistry } from '../tools/registry';
import type { DeclineReason, ToolOutcome } from '../tools/tool';
import { systemPrompt } from './system-prompt';

/**
 * System 2: the model answers what the fast path could not, acting only
 * through the allow-listed actions. The loop is bounded — rounds, actions per
 * round and output tokens — so a model that keeps calling actions cannot hold
 * a request open or run up the bill.
 */

export const MAX_ROUNDS = 4;
export const MAX_OUTPUT_TOKENS = 700;
export const MAX_CALLS_PER_ROUND = 6;
const HISTORY_TURNS = 12;
const HISTORY_CHARS = 1000;
export const EMPTY_REPLY =
  "I couldn't put together an answer to that. Could you rephrase it, or ask about his experience, skills or projects?";

export interface HistoryTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

export interface ModelAssistantRequest {
  readonly question: string;
  readonly history: readonly HistoryTurn[];
  /** Questions the fast path can answer, offered after this answer. */
  readonly followUps: readonly string[];
}

export interface ModelAssistant {
  answer(request: ModelAssistantRequest, signal?: AbortSignal): AsyncGenerator<AssistantEvent>;
}

interface Options {
  readonly model: LanguageModelPort;
  readonly tools: ToolRegistry;
  readonly clock: ClockPort;
}

function parseArguments(raw: string): unknown {
  try {
    return raw.trim() === '' ? {} : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function createModelAssistant({ model, tools, clock }: Options): ModelAssistant {
  const definitions = tools.tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));

  async function execute(call: ToolCall): Promise<ToolOutcome> {
    const parsed = parseArguments(call.arguments);
    if (parsed === undefined) return { ok: false, error: 'The arguments were not valid JSON.' };
    return tools.run(call.name, parsed);
  }

  return {
    async *answer({ question, history, followUps }, signal) {
      const messages: ModelMessage[] = [
        { role: 'system', content: systemPrompt(clock.now()) },
        ...history.slice(-HISTORY_TURNS).map((turn): ModelMessage => ({
          role: turn.role,
          content: turn.text.slice(0, HISTORY_CHARS),
        })),
        { role: 'user', content: question },
      ];
      const sources = new Map<string, AnswerSource>();
      const components: RichComponent[] = [];
      let declined: DeclineReason | null = null;
      let started = false;
      let wroteText = false;

      // Nothing is announced until the model produces something real, so a
      // failure while it is still consulting actions can be answered cleanly
      // by the caller's fallback instead of leaving a half-started reply.
      function* begin(): Generator<AssistantEvent> {
        if (!started) {
          started = true;
          yield { type: 'start', intent: 'model', related: null };
        }
      }

      for (let round = 1; round <= MAX_ROUNDS; round += 1) {
        let roundText = '';
        let calls: readonly ToolCall[] = [];
        const stream = model.stream({
          messages,
          tools: definitions,
          toolChoice: round === MAX_ROUNDS ? 'none' : 'auto',
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          ...(signal ? { signal } : {}),
        });
        for await (const event of stream) {
          if (event.type === 'text-delta' && event.delta) {
            yield* begin();
            if (!wroteText) {
              wroteText = true;
              yield { type: 'text-start', id: 'p0' };
            }
            roundText += event.delta;
            yield { type: 'text-delta', id: 'p0', delta: event.delta };
          } else if (event.type === 'tool-calls') {
            calls = event.calls;
          }
        }
        if (calls.length === 0) break;

        messages.push({ role: 'assistant', content: roundText || null, toolCalls: calls });
        // Actions in one round are independent, so they run concurrently: an
        // encyclopedia lookup and a GitHub read should not wait on each other.
        // Every call needs a reply, or the conversation is invalid; calls past
        // the cap get one that declines to run them.
        const outcomes = await Promise.all(
          calls.map((call, index): Promise<ToolOutcome> =>
            index < MAX_CALLS_PER_ROUND
              ? execute(call)
              : Promise.resolve({
                  ok: false,
                  error: 'Too many actions in one step; this one was not run.',
                }),
          ),
        );
        for (const [index, call] of calls.entries()) {
          const outcome = outcomes[index] ?? { ok: false, error: 'The action did not run.' };
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify(outcome.ok ? outcome.result.data : { error: outcome.error }),
          });
          if (!outcome.ok) continue;
          for (const source of outcome.result.sources) sources.set(source.id, source);
          const effect = outcome.result.effect;
          if (effect?.kind === 'display') components.push(effect.component);
          if (effect?.kind === 'decline') declined = effect.reason;
        }
      }

      yield* begin();
      if (!wroteText && components.length === 0) {
        // An empty reply would render as a blank bubble.
        yield { type: 'text-start', id: 'p0' };
        yield { type: 'text-delta', id: 'p0', delta: EMPTY_REPLY };
        wroteText = true;
      }
      if (wroteText) yield { type: 'text-end', id: 'p0' };
      for (const [index, component] of components.entries()) {
        yield { type: 'component', id: `p${String(index + 1)}`, ...component };
      }
      yield {
        type: 'finish',
        followUps,
        // A declined answer cites nothing, so it can never look grounded.
        sources: declined ? [] : [...sources.values()],
      };
    },
  };
}
