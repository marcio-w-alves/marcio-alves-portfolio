/**
 * Embeds the knowledge corpus and writes the committed retrieval index.
 *
 * Runs locally, with the model credential, whenever the knowledge base
 * changes — never during a build, which must not need secrets. The index
 * records the hash of the corpus it was built from, and a test fails if the
 * two drift apart.
 *
 *   pnpm rag:build
 */
import { writeFile } from 'node:fs/promises';
import { buildCorpus } from '../src/core/knowledge/corpus';
import { createOpenAIClient } from '../src/infrastructure/openai/openai-client';
import { createOpenAIEmbeddings } from '../src/infrastructure/openai/openai-embeddings';
import {
  corpusHash,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type KnowledgeIndex,
} from '../src/infrastructure/retrieval/index-spec';

const OUTPUT = new URL('../src/infrastructure/retrieval/knowledge-index.json', import.meta.url);

// Five decimals keep cosine similarity accurate to well below any ranking
// difference while cutting the committed file roughly in half.
const PRECISION = 1e5;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY is not set. Put it in .env.local.');

const chunks = buildCorpus();
const embeddings = createOpenAIEmbeddings({
  client: createOpenAIClient(apiKey),
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  // The whole corpus in one call, not one visitor's question.
  timeoutMs: 60_000,
});
const vectors = await embeddings.embed(chunks.map((chunk) => chunk.text));

const index: KnowledgeIndex = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  corpusHash: corpusHash(chunks),
  vectors: Object.fromEntries(
    chunks.map((chunk, i) => [
      chunk.id,
      (vectors[i] ?? []).map((value) => Math.round(value * PRECISION) / PRECISION),
    ]),
  ),
};

await writeFile(OUTPUT, `${JSON.stringify(index)}\n`);
console.log(`Indexed ${String(chunks.length)} passages → ${OUTPUT.pathname}`);
