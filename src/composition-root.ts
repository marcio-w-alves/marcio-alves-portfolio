import { createAssistant, type Assistant } from '@/core/assistant/assistant';
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
import { createOpenAIClient, OPENAI_TIMEOUT_MS } from '@/infrastructure/openai/openai-client';
import { createOpenAIEmbeddings } from '@/infrastructure/openai/openai-embeddings';
import { createOpenAILanguageModel } from '@/infrastructure/openai/openai-language-model';
import {
  createCircuitBreaker,
  withCircuitBreaker,
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

export interface Container {
  readonly assistant: Assistant;
  readonly reportError: (error: unknown) => void;
  readonly requestLimiter: SlidingWindowLimiter;
}

function reportError(error: unknown): void {
  console.error('[assistant]', error);
}

const budget = createModelBudget({
  answersPerWindow: MODEL_ANSWERS_PER_TEN_MINUTES,
  windowMs: TEN_MINUTES,
  dailyTokens: DAILY_MODEL_TOKENS,
});

export interface Observers {
  /** Every action the model ran; the evaluation reads the evidence from here. */
  readonly onToolResult?: (result: ToolTrace) => void;
}

export interface ContainerOptions extends Observers {
  /** Defaults to the validated process environment. */
  readonly env?: ServerEnv;
  /** How long an OpenAI call may wait for a response, or go quiet in the middle of one. */
  readonly openAITimeoutMs?: number;
}

interface ModelAssistantOptions extends Observers {
  readonly apiKey: string;
  readonly githubToken: string | undefined;
  readonly openAITimeoutMs: number;
}

function buildModelAssistant({
  apiKey,
  githubToken,
  openAITimeoutMs,
  onToolResult,
}: ModelAssistantOptions): ModelAssistant {
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
  const model = withCircuitBreaker(
    createOpenAILanguageModel({
      client,
      model: CHAT_MODEL,
      temperature: TEMPERATURE,
      idleTimeoutMs: openAITimeoutMs,
    }),
    createCircuitBreaker({ failureThreshold: 3, cooldownMs: 30_000 }),
  );
  return createModelAssistant({
    model,
    tools,
    clock: systemClock,
    onUsage: (usage) => {
      budget.record(usage);
    },
    ...(onToolResult ? { onToolResult } : {}),
  });
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
  return {
    assistant: createAssistant({
      // Without a credential the site still answers everything the fast
      // path recognizes, and says plainly what it cannot.
      modelAssistant: env.OPENAI_API_KEY
        ? buildModelAssistant({
            apiKey: env.OPENAI_API_KEY,
            githubToken: env.GITHUB_TOKEN,
            openAITimeoutMs,
            ...observers,
          })
        : null,
      budget,
      answerCache: createAnswerCache({ ttlMs: 60 * 60 * 1000, maxEntries: 500 }),
      reportError,
    }),
    reportError,
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
