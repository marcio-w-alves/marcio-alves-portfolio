import type { GithubPort } from '../../../src/core/assistant/ports/github.port';
import type { KnowledgeSearchPort } from '../../../src/core/assistant/ports/knowledge-search.port';
import type { ReferencePort } from '../../../src/core/assistant/ports/reference.port';
import { createResponseKit } from '../../../src/core/assistant/response-kit';
import { createExternalTools } from '../../../src/core/assistant/tools/external-tools';
import { createToolRegistry } from '../../../src/core/assistant/tools/registry';
import { createSearchTools } from '../../../src/core/assistant/tools/search-tools';
import type { Words } from './words';

/**
 * Every action the assistant has, as the composition root wires them: the
 * actions over the record, the ones that display part of it, declining, the
 * knowledge search and the public-reference lookups. Their names are what the
 * evaluation's calibration is checked against. Nothing is executed here, so
 * the ports the actions are built over answer nothing.
 */

const noSearch: KnowledgeSearchPort = { search: () => Promise.resolve([]) };
const noReferences: ReferencePort = { summary: () => Promise.resolve(null) };
const noGithub: GithubPort = {
  profile: () => Promise.resolve(null),
  repositories: () => Promise.resolve(null),
};

function ignore(): void {
  return undefined;
}

export function assistantActionNames(words: Words): ReadonlySet<string> {
  const { knowledge, answers } = words.en;
  const kit = createResponseKit(knowledge, answers.labels);
  const registry = createToolRegistry({
    kit,
    extra: [
      ...createSearchTools(noSearch, ignore),
      ...createExternalTools({ kit, references: noReferences, github: noGithub }),
    ],
    reportError: ignore,
  });
  return new Set(registry.tools.map(({ name }) => name));
}
