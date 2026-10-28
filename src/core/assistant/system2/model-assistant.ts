import type { AnswerSource, AssistantEvent } from '../assistant-event';
import type { RichComponent } from '../components';
import type { ClockPort } from '../ports/clock.port';
import type {
  LanguageModelPort,
  ModelMessage,
  ModelRequest,
  ModelUsage,
  ToolCall,
} from '../ports/language-model.port';
import type { ToolRegistry } from '../tools/registry';
import type { ToolOutcome } from '../tools/tool';
import { createLinkAllowList, createLinkFilter, urlsIn, type LinkAllowList } from './link-filter';
import { createOfferFilter } from './offer-filter';
import { systemPrompt } from './system-prompt';
import { createUsageMeter } from './usage';

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
  /**
   * Addresses an answer may always link to — the record's own. Any other
   * must have come back from an action during that answer.
   */
  readonly knownUrls?: readonly string[];
  /**
   * Called once per model call with what it cost, for the spending budget —
   * as reported, or estimated when the call was cut short.
   */
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

function startMessages(
  question: string,
  history: readonly HistoryTurn[],
  now: Date,
): ModelMessage[] {
  return [
    { role: 'system', content: systemPrompt(now) },
    ...history.slice(-HISTORY_TURNS).map((turn): ModelMessage => ({
      role: turn.role,
      content: turn.text.slice(0, HISTORY_CHARS),
    })),
    { role: 'user', content: question },
  ];
}

interface ModelTurn {
  readonly text: string;
  readonly calls: readonly ToolCall[];
}

interface ActionResult {
  readonly call: ToolCall;
  readonly outcome: ToolOutcome;
}

/** What every action in a round runs against. */
interface RoundContext {
  readonly searched: boolean;
  readonly question: string;
  readonly signal?: AbortSignal;
}

const SKIPPED_ACTION: ToolOutcome = {
  ok: false,
  error: 'Too many actions in one step; this one was not run.',
};

const SEARCH = 'searchKnowledge';
const SEARCH_FIRST =
  'Your decline was not recorded. These passages come from a search of his whole record for the question: answer from them if one answers it, and call declineToAnswer again only if none does.';
const MAX_QUERY = 300;
/**
 * The relevance from which the record probably answers the question, so a
 * decline made without a search is replaced by the passages. Below it the
 * decline stands: handed weakly related passages, the model wrote "not
 * documented" without declining and cited them. Calibrated on real
 * embeddings: answerable questions (his dogs, the Roots backend, MongoDB)
 * scored 0.53–0.74 and undocumented ones (GPA, salary, leaving Deel, Google)
 * 0.34–0.43.
 */
const ANSWERABLE = 0.5;

function bestRelevance(data: unknown): number {
  const passages = (data as { passages?: readonly { relevance?: number }[] }).passages ?? [];
  return Math.max(0, ...passages.map((passage) => passage.relevance ?? 0));
}

// Every call needs a reply, or the conversation is invalid.
function roundMessages(turn: ModelTurn, results: readonly ActionResult[]): ModelMessage[] {
  return [
    { role: 'assistant', content: turn.text || null, toolCalls: turn.calls },
    ...results.map(({ call, outcome }): ModelMessage => ({
      role: 'tool',
      toolCallId: call.id,
      content: JSON.stringify(outcome.ok ? outcome.result.data : { error: outcome.error }),
    })),
  ];
}

/**
 * The reply as the visitor sees it. Nothing is announced until the model
 * produces something real, so a failure while it is still consulting actions
 * can be answered cleanly by the caller's fallback instead of leaving a
 * half-started reply.
 */
function createReply(isLinkAllowed: (url: string) => boolean) {
  const offers = createOfferFilter();
  const links = createLinkFilter(isLinkAllowed);
  let started = false;
  let wroteText = false;

  function* begin(): Generator<AssistantEvent> {
    if (started) return;
    started = true;
    yield { type: 'start', intent: 'model', related: null };
  }

  function* show(text: string): Generator<AssistantEvent> {
    if (!text) return;
    yield* begin();
    if (!wroteText) {
      wroteText = true;
      yield { type: 'text-start', id: 'p0' };
    }
    yield { type: 'text-delta', id: 'p0', delta: text };
  }

  return {
    begin,
    write: (delta: string) => show(links.push(offers.push(delta))),
    // A sentence never runs on into the next round's text.
    endRound: () => show(links.push(offers.flush()) + links.flush()),
    /** Shown unfiltered when the answer would otherwise be empty. */
    fallback: (text: string) => show(text),
    *endText(): Generator<AssistantEvent> {
      if (wroteText) yield { type: 'text-end', id: 'p0' };
    },
    hasText: () => wroteText,
  };
}

type Reply = ReturnType<typeof createReply>;

/** What the actions contributed beyond data for the model: sources, displays and declines. */
interface Effects {
  readonly components: readonly RichComponent[];
  add(outcome: ToolOutcome): void;
  citedSources(): AnswerSource[];
}

function collectEffects(): Effects {
  const sources = new Map<string, AnswerSource>();
  const components: RichComponent[] = [];
  let declined = false;

  return {
    components,
    add(outcome: ToolOutcome): void {
      if (!outcome.ok) return;
      for (const source of outcome.result.sources) sources.set(source.id, source);
      const effect = outcome.result.effect;
      if (effect?.kind === 'display') components.push(effect.component);
      if (effect?.kind === 'decline') declined = true;
    },
    // A declined answer cites nothing, so it can never look grounded.
    citedSources: (): AnswerSource[] => (declined ? [] : [...sources.values()]),
  };
}

function allowLinksFrom(outcome: ToolOutcome, linkable: LinkAllowList): void {
  if (!outcome.ok) return;
  for (const { url } of outcome.result.sources) if (url) linkable.allow(url);
  for (const url of urlsIn(outcome.result.data)) linkable.allow(url);
}

function* closeAnswer(
  reply: Reply,
  effects: Effects,
  followUps: readonly string[],
): Generator<AssistantEvent> {
  yield* reply.begin();
  // An empty reply would render as a blank bubble.
  if (!reply.hasText() && effects.components.length === 0) yield* reply.fallback(EMPTY_REPLY);
  yield* reply.endText();
  for (const [index, component] of effects.components.entries()) {
    yield { type: 'component', id: `p${String(index + 1)}`, ...component };
  }
  yield { type: 'finish', followUps, sources: effects.citedSources() };
}

export function createModelAssistant({
  model,
  tools,
  clock,
  knownUrls = [],
  onUsage,
  onToolResult,
}: Options): ModelAssistant {
  const definitions = tools.tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));

  async function* streamRound(
    messages: readonly ModelMessage[],
    round: number,
    reply: Reply,
    signal?: AbortSignal,
  ): AsyncGenerator<AssistantEvent, ModelTurn> {
    let text = '';
    let calls: readonly ToolCall[] = [];
    const request: ModelRequest = {
      messages,
      tools: definitions,
      toolChoice: round === MAX_ROUNDS ? 'none' : 'auto',
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      ...(signal ? { signal } : {}),
    };
    const usage = createUsageMeter(request, (spent) => onUsage?.(spent));
    try {
      for await (const event of model.stream(request)) {
        usage.accepted();
        if (event.type === 'text-delta' && event.delta) {
          text += event.delta;
          yield* reply.write(event.delta);
        } else if (event.type === 'tool-calls') {
          calls = event.calls;
        } else if (event.type === 'finish') {
          usage.report(event.usage);
        }
      }
    } finally {
      usage.settle();
    }
    yield* reply.endRound();
    return { text, calls };
  }

  async function execute(call: ToolCall, signal?: AbortSignal): Promise<ToolOutcome> {
    const parsed = parseArguments(call.arguments);
    if (parsed === undefined) return { ok: false, error: 'The arguments were not valid JSON.' };
    return tools.run(call.name, parsed, signal);
  }

  const canSearch = tools.tools.some((tool) => tool.name === SEARCH);

  // The prompt asks for a search before anything is called not documented,
  // and the model still skips it after a narrower action comes back empty
  // ("did he work on the Roots backend?" once went getTechnologyEvidence →
  // decline, while his notes answer it), or calls it private ("what are his
  // dogs called?", which he chose to share). Sending the decline back was not
  // enough — the model then answered without searching — so the search runs
  // in its place, with the visitor's own question.

  function declinesUnsearched(call: ToolCall, searched: boolean): boolean {
    if (!canSearch || searched || call.name !== 'declineToAnswer') return false;
    const parsed = parseArguments(call.arguments) as { reason?: unknown } | undefined;
    return parsed?.reason === 'not_documented' || parsed?.reason === 'private';
  }

  async function searchInstead(
    question: string,
    decline: ToolCall,
    signal?: AbortSignal,
  ): Promise<ToolOutcome> {
    const outcome = await tools.run(SEARCH, { query: question.slice(0, MAX_QUERY) }, signal);
    if (!outcome.ok || bestRelevance(outcome.result.data) < ANSWERABLE) {
      return execute(decline, signal);
    }
    return {
      ok: true,
      result: { ...outcome.result, data: { note: SEARCH_FIRST, results: outcome.result.data } },
    };
  }

  // Calls past the cap get a reply that declines to run them.
  function outcomeOf(
    call: ToolCall,
    index: number,
    { searched, question, signal }: RoundContext,
  ): Promise<ToolOutcome> {
    if (index >= MAX_CALLS_PER_ROUND) return Promise.resolve(SKIPPED_ACTION);
    if (declinesUnsearched(call, searched)) return searchInstead(question, call, signal);
    return execute(call, signal);
  }

  // Actions in one round are independent, so they run concurrently: an
  // encyclopedia lookup and a GitHub read should not wait on each other.
  function runActions(calls: readonly ToolCall[], context: RoundContext): Promise<ActionResult[]> {
    return Promise.all(
      calls.map(async (call, index) => ({ call, outcome: await outcomeOf(call, index, context) })),
    );
  }

  return {
    async *answer({ question, history, followUps }, signal) {
      const messages = startMessages(question, history, clock.now());
      const linkable = createLinkAllowList(knownUrls);
      const reply = createReply((url) => linkable.allows(url));
      const effects = collectEffects();
      let searched = false;

      for (let round = 1; round <= MAX_ROUNDS; round += 1) {
        const turn = yield* streamRound(messages, round, reply, signal);
        if (turn.calls.length === 0) break;

        const searchedBefore: boolean = searched || turn.calls.some((call) => call.name === SEARCH);
        const results = await runActions(turn.calls, {
          searched: searchedBefore,
          question,
          ...(signal ? { signal } : {}),
        });
        // A decline replaced by a search counts as that search.
        searched =
          searchedBefore || turn.calls.some((call) => declinesUnsearched(call, searchedBefore));
        messages.push(...roundMessages(turn, results));
        for (const { call, outcome } of results) {
          onToolResult?.({ name: call.name, arguments: call.arguments, outcome });
          effects.add(outcome);
          allowLinksFrom(outcome, linkable);
        }
      }

      yield* closeAnswer(reply, effects, followUps);
    },
  };
}
