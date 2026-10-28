/**
 * Embeds the profile's retrieval probes (`src/profile/retrieval-probes.ts`)
 * with the same model, dimensions and rounding as the index, and writes them
 * beside it. A test fails while they do not match the questions.
 * `pnpm rag:build` runs this after the index.
 *
 *   pnpm rag:probes
 */
import { writeFile } from 'node:fs/promises';
import { createOpenAIClient } from '../src/infrastructure/openai/openai-client';
import { createOpenAIEmbeddings } from '../src/infrastructure/openai/openai-embeddings';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../src/infrastructure/retrieval/index-spec';
import { RETRIEVAL_PROBES } from '../src/profile/retrieval-probes';

const OUTPUT = new URL('../src/profile/generated/retrieval-probes.json', import.meta.url);
const PRECISION = 1e5;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY is not set. Put it in .env.local.');

const questions = Object.values(RETRIEVAL_PROBES);
const embeddings = createOpenAIEmbeddings({
  client: createOpenAIClient(apiKey),
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  timeoutMs: 60_000,
});
const vectors = await embeddings.embed(questions);

await writeFile(
  OUTPUT,
  `${JSON.stringify({
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    vectors: Object.fromEntries(
      questions.map((question, i) => [
        question,
        (vectors[i] ?? []).map((value) => Math.round(value * PRECISION) / PRECISION),
      ]),
    ),
  })}\n`,
);
console.log(`Embedded ${String(questions.length)} probes → ${OUTPUT.pathname}`);
