import type { AnswerSource, AssistantEvent } from '../assistant-event';
import type { RichComponent } from '../components';
import type { ClockPort } from '../ports/clock.port';
import type {
  LanguageModelPort,
  ModelMessage,
  ModelUsage,
  ToolCall,
} from '../ports/language-model.port';
import type { ToolRegistry } from '../tools/registry';
import type { DeclineReason, ToolOutcome } from '../tools/tool';
import { createOfferFilter } from './offer-filter';
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
  /** Called once per model call with what it cost, for the spending budget. */
  readonly onUsage?: (usage: ModelUsage) => void;
  /** Called with every action the model ran and what it got back — the evidence an answer rests on. */
  readonly onToolResult?: (result: ToolTrace) => void;
}

export interface ToolTrace {
  readonly name: string;
  readonly arguments: string;
  readonly outcome: ToolOutcome;
}

function parseArguments(raw: string): unknown {
  try {
    return raw.trim() === '' ? {} : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const SEARCH = 'searchKnowledge';
const SEARCH_FIRST =
  'Your decline was not recorded. These passages come from a search of his whole record for the question: answer from them if one answers it, and call declineToAnswer again only if none does.';
const MAX_QUERY = 300;

export function createModelAssistant({
  model,
  tools,
  clock,
  onUsage,
  onToolResult,
}: Options): ModelAssistant {
  const definitions = tools.tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));

  const canSearch = tools.tools.some((tool) => tool.name === SEARCH);

  async function execute(call: ToolCall): Promise<ToolOutcome> {
    const parsed = parseArguments(call.arguments);
    if (parsed === undefined) return { ok: false, error: 'The arguments were not valid JSON.' };
    return tools.run(call.name, parsed);
  }

  // The prompt asks for a search before anything is called not documented,
  // and the model still skips it after a narrower action comes back empty
  // ("did he work on the Roots backend?" once went getTechnologyEvidence →
  // decline, while his notes answer it). Sending the decline back was not
  // enough — the model then answered without searching — so the search runs
  // in its place, with the visitor's own question.

  function declinesUnsearched(call: ToolCall, searched: boolean): boolean {
    if (!canSearch || searched || call.name !== 'declineToAnswer') return false;
    const parsed = parseArguments(call.arguments) as { reason?: unknown } | undefined;
    return parsed?.reason === 'not_documented';
  }

  async function searchInstead(question: string): Promise<ToolOutcome> {
    const outcome = await tools.run(SEARCH, { query: question.slice(0, MAX_QUERY) });
    if (!outcome.ok) return outcome;
    return {
      ok: true,
      result: { ...outcome.result, data: { note: SEARCH_FIRST, results: outcome.result.data } },
    };
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
      // Set inside write(), which narrowing cannot see.
      let wroteText = false as boolean;
      const offers = createOfferFilter();
      let searched = false;

      // Nothing is announced until the model produces something real, so a
      // failure while it is still consulting actions can be answered cleanly
      // by the caller's fallback instead of leaving a half-started reply.
      function* begin(): Generator<AssistantEvent> {
        if (!started) {
          started = true;
          yield { type: 'start', intent: 'model', related: null };
        }
      }

      function* write(text: string): Generator<AssistantEvent> {
        if (!text) return;
        yield* begin();
        if (!wroteText) {
          wroteText = true;
          yield { type: 'text-start', id: 'p0' };
        }
        yield { type: 'text-delta', id: 'p0', delta: text };
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
            roundText += event.delta;
            yield* write(offers.push(event.delta));
          } else if (event.type === 'tool-calls') {
            calls = event.calls;
          } else if (event.type === 'finish') {
            onUsage?.(event.usage);
          }
        }
        // A sentence never runs on into the next round's text.
        yield* write(offers.flush());
        if (calls.length === 0) break;

        messages.push({ role: 'assistant', content: roundText || null, toolCalls: calls });
        // Actions in one round are independent, so they run concurrently: an
        // encyclopedia lookup and a GitHub read should not wait on each other.
        // Every call needs a reply, or the conversation is invalid; calls past
        // the cap get one that declines to run them.
        const searchesNow: boolean = searched || calls.some((call) => call.name === SEARCH);
        const searchesInstead = (call: ToolCall) => declinesUnsearched(call, searchesNow);
        searched = searchesNow || calls.some(searchesInstead);
        const outcomes = await Promise.all(
          calls.map((call, index): Promise<ToolOutcome> =>
            index >= MAX_CALLS_PER_ROUND
              ? Promise.resolve({
                  ok: false,
                  error: 'Too many actions in one step; this one was not run.',
                })
              : searchesInstead(call)
                ? searchInstead(question)
                : execute(call),
          ),
        );
        for (const [index, call] of calls.entries()) {
          const outcome = outcomes[index] ?? { ok: false, error: 'The action did not run.' };
          onToolResult?.({ name: call.name, arguments: call.arguments, outcome });
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
