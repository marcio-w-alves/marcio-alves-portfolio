/**
 * Writes the example profile's generated files without a key: its note
 * passages from its knowledge base, and a seeded retrieval index and probe
 * embeddings (see `scripts/profile/seeded-index.ts`). Run it after editing the
 * example's record, notes or probes; its checks fail until then.
 *
 *   pnpm exec tsx scripts/example/generate-example-files.mts
 */
import { fileURLToPath } from 'node:url';
import { parseNotes } from '../../src/core/knowledge/notes';
import type { KnowledgeSource } from '../../src/core/knowledge/schema';
import { decodeBundle } from '../profile/bundle/decode';
import { DOCUMENTS } from '../profile/bundle/layout';
import { seededIndex, seededProbes } from '../profile/seeded-index';
import { bundleDirectory } from '../profile/workspace/bundle-directory';
import type { Document } from '../profile/workspace/workspace';

const EXAMPLE = fileURLToPath(new URL('../../profiles/example/', import.meta.url));
const json = (text: string): Document => ({
  mediaType: 'application/json',
  bytes: new TextEncoder().encode(text),
});

const workspace = bundleDirectory(EXAMPLE);

const before = await workspace.read();
const notes = parseNotes(decodeBundle(before.profile.documents).knowledgeBase);
const afterNotes = await workspace.write(
  {
    put: new Map([[DOCUMENTS.notes, json(`${JSON.stringify(notes, null, 1)}\n`)]]),
    remove: [],
    origin: 'notes-build',
  },
  before.revision,
);

const { data } = decodeBundle((await workspace.read()).profile.documents);
const probes = Object.values(data.retrievalProbes as Readonly<Record<string, string>>);
await workspace.write(
  {
    put: new Map([
      [DOCUMENTS.index, json(seededIndex(data.knowledge as KnowledgeSource))],
      [DOCUMENTS.probeEmbeddings, json(seededProbes(probes))],
    ]),
    remove: [],
    origin: 'rag-build',
  },
  afterNotes,
);
console.log(`Wrote the example's notes, seeded index and probes → ${EXAMPLE}generated/`);
