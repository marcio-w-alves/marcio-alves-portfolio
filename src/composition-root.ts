import 'server-only';
import type { ModelBudgetPort } from '@/core/assistant/ports/model-budget.port';
import { createAssistant, type AnswerReport, type Assistant } from '@/core/assistant/assistant';
import {
  createModelAssistant,
  type ModelAssistant,
  type ToolTrace,
} from '@/core/assistant/system2/model-assistant';
import { createExternalTools } from '@/core/assistant/tools/external-tools';
import { createToolRegistry } from '@/core/assistant/tools/registry';
import { createSearchTools } from '@/core/assistant/tools/search-tools';
import type { ToolFailure } from '@/core/assistant/tools/tool';
import { buildCorpus } from '@/core/knowledge/corpus';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import {
  assistantSettings,
  serverEnv,
  siteUrl,
  type AssistantSettings,
  type ServerEnv,
} from '@/env';
import { createAnswerCache } from '@/infrastructure/budget/answer-cache';
import { createModelBudget } from '@/infrastructure/budget/model-budget';
import { createGithubApi } from '@/infrastructure/github/github-api';
import { createClientTagger } from '@/infrastructure/logging/client-tag';
import { errorFields, logger } from '@/infrastructure/logging/logger';
import { createOpenAIClient } from '@/infrastructure/openai/openai-client';
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

// Zero, for determinism: the same question and evidence give the same answer,
// which keeps answers close to the action results and reproducible.
const TEMPERATURE = 0;

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * What the health check may say about the model: whether it is configured,
 * and whether it and retrieval are reachable.
 */
export interface ModelStatus {
  readonly model: 'enabled' | 'disabled';
  /** The chat model's circuit. Null when there is no model to guard. */
  readonly circuit: CircuitState | null;
  /** The embeddings circuit behind search. Null when there is no model to guard. */
  readonly retrieval: CircuitState | null;
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

function reportToolError({ tool, error }: ToolFailure): void {
  logger.warn('tool.failed', { tool, ...errorFields(error) });
}

function reportRateLimited(clientId: string): void {
  logger.warn('chat.rate_limited', { client: tagClient(clientId) });
}

function createBudget(settings: AssistantSettings): ModelBudgetPort {
  return createModelBudget({
    answersPerWindow: settings.modelAnswersPerTenMinutes,
    windowMs: TEN_MINUTES,
    dailyTokens: settings.dailyModelTokens,
    onExhausted: () => {
      logger.warn('model.budget_exhausted', { dailyTokens: settings.dailyModelTokens });
    },
    onEvicted: () => {
      logger.warn('limiter.evicted', { limiter: 'model-answers' });
    },
  });
}

function createCircuitBreakerFor(dependency: 'model' | 'retrieval'): CircuitBreaker {
  return createCircuitBreaker({
    failureThreshold: 3,
    cooldownMs: 30_000,
    onTransition: (to) => {
      if (to === 'open') logger.warn(`${dependency}.circuit_opened`);
      else logger.info(`${dependency}.circuit_closed`);
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
  readonly retrievalBreaker: CircuitBreaker;
}

export interface ContainerOptions extends Observers {
  /** Defaults to the validated process environment. */
  readonly env?: ServerEnv;
  /** Defaults to the settings in the process environment. */
  readonly settings?: AssistantSettings;
  /** How long an OpenAI call may wait for a response, or go quiet in the middle of one. */
  readonly openAITimeoutMs?: number;
}

interface ModelWiring {
  readonly apiKey: string;
  readonly githubToken: string | undefined;
  readonly chatModel: string;
  readonly openAITimeoutMs: number;
  readonly budget: ModelBudgetPort;
}

function buildModelAssistant(
  { apiKey, githubToken, chatModel, openAITimeoutMs, budget }: ModelWiring,
  observers: Observers,
): GuardedModelAssistant {
  const client = createOpenAIClient(apiKey, { timeoutMs: openAITimeoutMs });
  const retrievalBreaker = createCircuitBreakerFor('retrieval');
  const search = createVectorKnowledgeSearch({
    embeddings: createOpenAIEmbeddings({
      client,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    index: knowledgeIndex,
    corpus: buildCorpus(),
    breaker: retrievalBreaker,
  });
  const github = createGithubApi({
    username: new URL(knowledgeBase.contact.github).pathname.slice(1),
    ...(githubToken ? { token: githubToken } : {}),
    logger,
  });
  const tools = createToolRegistry({
    extra: [
      ...createSearchTools(search, reportToolError),
      ...createExternalTools({
        references: createWikipediaReferences({ siteUrl: siteUrl(), logger }),
        github,
      }),
    ],
    reportError: reportToolError,
  });
  const breaker = createCircuitBreakerFor('model');
  const model = withCircuitBreaker(
    createOpenAILanguageModel({
      client,
      model: chatModel,
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
      if (usage.estimated) {
        logger.info('model.usage_estimated', {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        });
      }
    },
    ...(observers.onToolResult ? { onToolResult: observers.onToolResult } : {}),
  });
  return { assistant, breaker, retrievalBreaker };
}

/**
 * Builds the wiring. The site uses the shared instance below; the evaluation
 * builds its own, observed, and the route's integration tests their own,
 * with a test environment and a short timeout.
 */
export function buildContainer({
  env = serverEnv(),
  settings = assistantSettings(),
  openAITimeoutMs = settings.openAITimeoutMs,
  ...observers
}: ContainerOptions = {}): Container {
  const budget = createBudget(settings);
  // Without a credential the site still answers everything the fast path
  // recognizes, and says plainly what it cannot.
  const model = env.OPENAI_API_KEY
    ? buildModelAssistant(
        {
          apiKey: env.OPENAI_API_KEY,
          githubToken: env.GITHUB_TOKEN,
          chatModel: settings.chatModel,
          openAITimeoutMs,
          budget,
        },
        observers,
      )
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
      retrieval: model?.retrievalBreaker.state() ?? null,
    }),
    requestLimiter: createSlidingWindowLimiter({
      limit: settings.requestsPerTenMinutes,
      windowMs: TEN_MINUTES,
      onEvicted: () => {
        logger.warn('limiter.evicted', { limiter: 'requests' });
      },
    }),
  };
}

let container: Container | undefined;

export function getContainer(): Container {
  container ??= buildContainer();
  return container;
}
