import 'server-only';
import type { ModelBudgetPort } from '@/core/assistant/ports/model-budget.port';
import type { AnswerSet } from '@/core/assistant/answer-set';
import { createAssistant, type AnswerReport, type Assistant } from '@/core/assistant/assistant';
import { createResponseKit } from '@/core/assistant/response-kit';
import { createFastPath, type LanguageAnswers } from '@/core/assistant/system1/fast-path';
import { urlsIn } from '@/core/assistant/system2/link-filter';
import { promptSubject } from '@/core/assistant/system2/system-prompt';
import {
  createModelAssistant,
  type ModelAssistant,
  type ToolTrace,
} from '@/core/assistant/system2/model-assistant';
import { createExternalTools } from '@/core/assistant/tools/external-tools';
import { createToolRegistry } from '@/core/assistant/tools/registry';
import { createSearchTools } from '@/core/assistant/tools/search-tools';
import type { ToolFailure } from '@/core/assistant/tools/tool';
import { mapTranslations, type Translations } from '@/core/i18n/locale';
import { buildCorpus } from '@/core/knowledge/corpus';
import { localize } from '@/core/knowledge/localize';
import type { KnowledgeSource } from '@/core/knowledge/schema';
import {
  assistantSettings,
  serverEnv,
  siteUrl,
  type AssistantSettings,
  type ServerEnv,
} from '@/env';
import type { ModelStatus } from '@/http/health-handler';
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
} from '@/infrastructure/resilience/circuit-breaker';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '@/infrastructure/retrieval/index-spec';
import { createVectorKnowledgeSearch } from '@/infrastructure/retrieval/vector-knowledge-search';
import {
  createSlidingWindowLimiter,
  type SlidingWindowLimiter,
} from '@/infrastructure/rate-limit/sliding-window';
import { systemClock } from '@/infrastructure/system-clock';
import { createWikipediaReferences } from '@/infrastructure/wikipedia/wikipedia-references';
import { profile } from '@/profile';
import knowledgeIndex from '@/profile/generated/knowledge-index.json';

/**
 * The only place where concrete adapters are bound to the ports the core
 * depends on. Nothing under `src/core` may import from here.
 */

// Zero, for determinism: the same question and evidence give the same answer,
// which keeps answers close to the action results and reproducible.
const TEMPERATURE = 0;

const TEN_MINUTES = 10 * 60 * 1000;

const { identity } = profile;

export interface Container {
  readonly assistant: Assistant;
  readonly reportError: (error: unknown) => void;
  readonly requestLimiter: SlidingWindowLimiter;
  readonly reportRateLimited: (clientId: string) => void;
  readonly modelStatus: () => ModelStatus;
  readonly requestTimeoutMs: number;
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
    clientDailyTokens: settings.clientDailyModelTokens,
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
  /**
   * Defaults to the profile's record. Each language's answers read it in that
   * language, the search in every language it is written in.
   */
  readonly record?: KnowledgeSource;
  /** Defaults to the profile's copy in each language it writes; written for the record above. */
  readonly answers?: Translations<AnswerSet>;
  /** Defaults to the validated process environment. */
  readonly env?: ServerEnv;
  /** Defaults to the settings in the process environment. */
  readonly settings?: AssistantSettings;
  /** How long an OpenAI call may wait for a response, or go quiet in the middle of one. */
  readonly openAITimeoutMs?: number;
}

interface ModelWiring {
  readonly record: KnowledgeSource;
  /** The record and the answers' words in each language the site is written in. */
  readonly languages: Translations<LanguageAnswers>;
  readonly apiKey: string;
  readonly githubToken: string | undefined;
  readonly chatModel: string;
  readonly openAITimeoutMs: number;
  readonly budget: ModelBudgetPort;
}

function buildModelAssistant(
  { record, languages, apiKey, githubToken, chatModel, openAITimeoutMs, budget }: ModelWiring,
  observers: Observers,
): GuardedModelAssistant {
  const client = createOpenAIClient(apiKey, { timeoutMs: openAITimeoutMs });
  const kits = mapTranslations(languages, ({ knowledge, answers }) =>
    createResponseKit(knowledge, answers.labels),
  );
  const { knowledge } = languages.en;
  // One index, one embedding client and one breaker; each language cites its
  // sources by its own labels.
  const retrievalBreaker = createCircuitBreakerFor('retrieval');
  const embeddings = createOpenAIEmbeddings({
    client,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const corpus = buildCorpus(record);
  const github = createGithubApi({
    username: new URL(identity.contact.github).pathname.slice(1),
    userAgent: identity.userAgentProduct,
    ...(githubToken ? { token: githubToken } : {}),
    logger,
  });
  const references = createWikipediaReferences({
    product: identity.userAgentProduct,
    siteUrl: siteUrl(),
    logger,
  });
  const tools = mapTranslations(kits, (kit) =>
    createToolRegistry({
      kit,
      extra: [
        ...createSearchTools(
          createVectorKnowledgeSearch({
            embeddings,
            index: knowledgeIndex,
            corpus,
            citation: kit.citation,
            breaker: retrievalBreaker,
          }),
          reportToolError,
        ),
        ...createExternalTools({ kit, references, github }),
      ],
      reportError: reportToolError,
    }),
  );
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
    subject: promptSubject(knowledge),
    knownUrls: [...urlsIn(knowledge), `mailto:${knowledge.contact.email}`, siteUrl().href],
    onUsage: (usage, clientId) => {
      budget.record(usage, clientId);
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
  record = profile.knowledge,
  answers = mapTranslations(profile.copy, (copy) => copy.answers),
  env = serverEnv(),
  settings = assistantSettings(),
  openAITimeoutMs = settings.openAITimeoutMs,
  ...observers
}: ContainerOptions = {}): Container {
  const languages = mapTranslations(answers, (answerSet, locale) => ({
    knowledge: localize(record, locale),
    answers: answerSet,
  }));
  const budget = createBudget(settings);
  // Without a credential the site still answers everything the fast path
  // recognizes, and says plainly what it cannot.
  const model = env.OPENAI_API_KEY
    ? buildModelAssistant(
        {
          record,
          languages,
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
      fastPath: createFastPath(languages),
      modelAssistant: model?.assistant ?? null,
      budget,
      answerCache: createAnswerCache({ ttlMs: 60 * 60 * 1000, maxEntries: 500 }),
      clock: systemClock,
      reportError,
      onAnswered: reportAnswered,
    }),
    reportError,
    reportRateLimited,
    requestTimeoutMs: settings.chatRequestTimeoutMs,
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
