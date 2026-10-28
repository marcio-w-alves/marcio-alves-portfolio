import { createAssistant, type AnswerReport, type Assistant } from '@/core/assistant/assistant';
import {
  createModelAssistant,
  type ModelAssistant,
  type ToolTrace,
} from '@/core/assistant/system2/model-assistant';
import { createExternalTools } from '@/core/assistant/tools/external-tools';
import { createToolRegistry } from '@/core/assistant/tools/registry';
import { createSearchTools } from '@/core/assistant/tools/search-tools';
import { buildCorpus } from '@/core/knowledge/corpus';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { serverEnv, type ServerEnv } from '@/env';
import { createAnswerCache } from '@/infrastructure/budget/answer-cache';
import { createModelBudget } from '@/infrastructure/budget/model-budget';
import { createGithubApi } from '@/infrastructure/github/github-api';
import { createClientTagger } from '@/infrastructure/logging/client-tag';
import { errorFields, logger } from '@/infrastructure/logging/logger';
import { createOpenAIClient, OPENAI_TIMEOUT_MS } from '@/infrastructure/openai/openai-client';
import { createOpenAIEmbeddings } from '@/infrastructure/openai/openai-embeddings';
import { createOpenAILanguageModel } from '@/infrastructure/openai/openai-language-model';
import {
  createCircuitBreaker,
  withCircuitBreaker,
  type CircuitBreaker,
  type CircuitState,
} from '@/infrastructure/resilience/circuit-breaker';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '@/infrastructure/retrieval/index-spec';
import knowledgeIndex from '@/infrastructure/retrieval/knowledge-index.json';
import { createVectorKnowledgeSearch } from '@/infrastructure/retrieval/vector-knowledge-search';
import {
  createSlidingWindowLimiter,
  type SlidingWindowLimiter,
} from '@/infrastructure/rate-limit/sliding-window';
import { systemClock } from '@/infrastructure/system-clock';
import { createWikipediaReferences } from '@/infrastructure/wikipedia/wikipedia-references';

/**
 * The only place where concrete adapters are bound to the ports the core
 * depends on. Nothing under `src/core` may import from here.
 */

const CHAT_MODEL = 'gpt-4o-mini';
// Low but not zero: answers stay close to the action results without reading
// like a form letter.
const TEMPERATURE = 0;

const TEN_MINUTES = 10 * 60 * 1000;
/** Any request, fast path included: enough for a curious visitor, not for a script. */
const REQUESTS_PER_TEN_MINUTES = 40;
/** Model answers specifically, the part that costs money. */
const MODEL_ANSWERS_PER_TEN_MINUTES = 15;
/**
 * Roughly two hundred model answers a day per instance — about US$0.35 at
 * gpt-4o-mini prices. Per instance, so the hard ceiling is the spending limit
 * set on the OpenAI project itself.
 */
const DAILY_MODEL_TOKENS = 2_000_000;

/** What the health check may say about the model: whether it is configured, and whether it is reachable. */
export interface ModelStatus {
  readonly model: 'enabled' | 'disabled';
  /** Null when there is no model to guard. */
  readonly circuit: CircuitState | null;
}

export interface Container {
  readonly assistant: Assistant;
  readonly reportError: (error: unknown) => void;
  readonly requestLimiter: SlidingWindowLimiter;
  readonly reportRateLimited: (clientId: string) => void;
  readonly modelStatus: () => ModelStatus;
}

const tagClient = createClientTagger();

function reportError(error: unknown): void {
  logger.error('assistant.failed', errorFields(error));
}

function reportAnswered({ clientId, ...handling }: AnswerReport): void {
  logger.info('chat.answered', { ...handling, client: tagClient(clientId) });
}

function reportRateLimited(clientId: string): void {
  logger.warn('chat.rate_limited', { client: tagClient(clientId) });
}

const budget = createModelBudget({
  answersPerWindow: MODEL_ANSWERS_PER_TEN_MINUTES,
  windowMs: TEN_MINUTES,
  dailyTokens: DAILY_MODEL_TOKENS,
  onExhausted: () => {
    logger.warn('model.budget_exhausted', { dailyTokens: DAILY_MODEL_TOKENS });
  },
});

function createModelCircuitBreaker(): CircuitBreaker {
  return createCircuitBreaker({
    failureThreshold: 3,
    cooldownMs: 30_000,
    onTransition: (to) => {
      if (to === 'open') logger.warn('model.circuit_opened');
      else logger.info('model.circuit_closed');
    },
  });
}

export interface Observers {
  /** Every action the model ran; the evaluation reads the evidence from here. */
  readonly onToolResult?: (result: ToolTrace) => void;
}

interface GuardedModelAssistant {
  readonly assistant: ModelAssistant;
  readonly breaker: CircuitBreaker;
}

export interface ContainerOptions extends Observers {
  /** Defaults to the validated process environment. */
  readonly env?: ServerEnv;
  /** How long an OpenAI call may wait for a response, or go quiet in the middle of one. */
  readonly openAITimeoutMs?: number;
}

function buildModelAssistant(
  apiKey: string,
  githubToken: string | undefined,
  openAITimeoutMs: number,
  observers: Observers,
): GuardedModelAssistant {
  const client = createOpenAIClient(apiKey, { timeoutMs: openAITimeoutMs });
  const search = createVectorKnowledgeSearch({
    embeddings: createOpenAIEmbeddings({
      client,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    index: knowledgeIndex,
    corpus: buildCorpus(),
  });
  const github = createGithubApi({
    username: new URL(knowledgeBase.contact.github).pathname.slice(1),
    ...(githubToken ? { token: githubToken } : {}),
  });
  const tools = createToolRegistry([
    ...createSearchTools(search),
    ...createExternalTools({ references: createWikipediaReferences(), github }),
  ]);
  const breaker = createModelCircuitBreaker();
  const model = withCircuitBreaker(
    createOpenAILanguageModel({
      client,
      model: CHAT_MODEL,
      temperature: TEMPERATURE,
      idleTimeoutMs: openAITimeoutMs,
    }),
    breaker,
  );
  const assistant = createModelAssistant({
    model,
    tools,
    clock: systemClock,
    onUsage: (usage) => {
      budget.record(usage);
    },
    ...(observers.onToolResult ? { onToolResult: observers.onToolResult } : {}),
  });
  return { assistant, breaker };
}

/**
 * Builds the wiring. The site uses the shared instance below; the evaluation
 * builds its own, observed, and the route's integration tests their own,
 * with a test environment and a short timeout.
 */
export function buildContainer({
  env = serverEnv(),
  openAITimeoutMs = OPENAI_TIMEOUT_MS,
  ...observers
}: ContainerOptions = {}): Container {
  // Without a credential the site still answers everything the fast path
  // recognizes, and says plainly what it cannot.
  const model = env.OPENAI_API_KEY
    ? buildModelAssistant(env.OPENAI_API_KEY, env.GITHUB_TOKEN, openAITimeoutMs, observers)
    : null;
  return {
    assistant: createAssistant({
      modelAssistant: model?.assistant ?? null,
      budget,
      answerCache: createAnswerCache({ ttlMs: 60 * 60 * 1000, maxEntries: 500 }),
      clock: systemClock,
      reportError,
      onAnswered: reportAnswered,
    }),
    reportError,
    reportRateLimited,
    modelStatus: () => ({
      model: model ? 'enabled' : 'disabled',
      circuit: model?.breaker.state() ?? null,
    }),
    requestLimiter: createSlidingWindowLimiter({
      limit: REQUESTS_PER_TEN_MINUTES,
      windowMs: TEN_MINUTES,
    }),
  };
}

let container: Container | undefined;

export function getContainer(): Container {
  container ??= buildContainer();
  return container;
}
