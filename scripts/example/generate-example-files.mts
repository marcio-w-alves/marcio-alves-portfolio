/**
 * Writes the example profile's generated files without a key: its note
 * passages from its knowledge base, and a seeded retrieval index and probe
 * embeddings (see `scripts/profile/seeded-index.ts`). Run it after editing the
 * example's record, notes or probes; its checks fail until then.
 *
 *   pnpm exec tsx scripts/example/generate-example-files.mts [bundle dir]
 *
 * The directory is the example's own unless one is named, which is how a test
 * drives this builder over a copy instead of the committed bundle.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNotes } from '../../src/core/knowledge/notes';
import type { KnowledgeSource } from '../../src/core/knowledge/schema';
import { decodeBundle } from '../profile/bundle/decode';
import { DOCUMENTS } from '../profile/bundle/layout';
import { seededIndex, seededProbes } from '../profile/seeded-index';
import { bundleDirectory } from '../profile/workspace/bundle-directory';
import type { Document } from '../profile/workspace/workspace';

const DEFAULT_DIR = fileURLToPath(new URL('../../profiles/example/', import.meta.url));
const bundle = process.argv[2] === undefined ? DEFAULT_DIR : resolve(process.argv[2]);
const json = (text: string): Document => ({
  mediaType: 'application/json',
  bytes: new TextEncoder().encode(text),
});

const workspace = bundleDirectory(bundle);

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
console.log(`Wrote the notes, seeded index and probes of ${bundle}`);
