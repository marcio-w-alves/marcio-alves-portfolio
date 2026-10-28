import { createAssistant, type Assistant } from '@/core/assistant/assistant';
import {
  createModelAssistant,
  type ModelAssistant,
} from '@/core/assistant/system2/model-assistant';
import { createExternalTools } from '@/core/assistant/tools/external-tools';
import { createToolRegistry } from '@/core/assistant/tools/registry';
import { createSearchTools } from '@/core/assistant/tools/search-tools';
import { buildCorpus } from '@/core/knowledge/corpus';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { serverEnv } from '@/env';
import { createGithubApi } from '@/infrastructure/github/github-api';
import { createOpenAIClient } from '@/infrastructure/openai/openai-client';
import { createOpenAIEmbeddings } from '@/infrastructure/openai/openai-embeddings';
import { createOpenAILanguageModel } from '@/infrastructure/openai/openai-language-model';
import {
  createCircuitBreaker,
  withCircuitBreaker,
} from '@/infrastructure/resilience/circuit-breaker';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '@/infrastructure/retrieval/index-spec';
import knowledgeIndex from '@/infrastructure/retrieval/knowledge-index.json';
import { createVectorKnowledgeSearch } from '@/infrastructure/retrieval/vector-knowledge-search';
import { systemClock } from '@/infrastructure/system-clock';
import { createWikipediaReferences } from '@/infrastructure/wikipedia/wikipedia-references';

/**
 * The only place where concrete adapters are bound to the ports the core
 * depends on. Nothing under `src/core` may import from here.
 */

const CHAT_MODEL = 'gpt-4o-mini';
// Low but not zero: answers stay close to the action results without reading
// like a form letter.
const TEMPERATURE = 0.2;

export interface Container {
  readonly assistant: Assistant;
  readonly reportError: (error: unknown) => void;
}

function reportError(error: unknown): void {
  console.error('[assistant]', error);
}

function buildModelAssistant(apiKey: string, githubToken: string | undefined): ModelAssistant {
  const client = createOpenAIClient(apiKey);
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
    createOpenAILanguageModel({ client, model: CHAT_MODEL, temperature: TEMPERATURE }),
    createCircuitBreaker({ failureThreshold: 3, cooldownMs: 30_000 }),
  );
  return createModelAssistant({ model, tools, clock: systemClock });
}

let container: Container | undefined;

export function getContainer(): Container {
  if (!container) {
    const env = serverEnv();
    container = {
      assistant: createAssistant({
        // Without a credential the site still answers everything the fast
        // path recognizes, and says plainly what it cannot.
        modelAssistant: env.OPENAI_API_KEY
          ? buildModelAssistant(env.OPENAI_API_KEY, env.GITHUB_TOKEN)
          : null,
        reportError,
      }),
      reportError,
    };
  }
  return container;
}
