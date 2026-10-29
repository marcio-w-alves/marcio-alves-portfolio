/**
 * Writes the profile this repository still holds as TypeScript into a bundle,
 * so the bundle format can be shown to carry a whole real profile — and so the
 * owner has the file form of his own before any of it moves.
 *
 * The bundle is written under PROFILE_HOME (never inside the repository), and
 * holds everything except the copy, which is TypeScript until POR-91 turns it
 * into data.
 *
 *   pnpm exec tsx scripts/profile/export-repository-profile.mts
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { profile } from '../../src/profile';
import { REPOSITORY as SOURCE_REPOSITORY } from '../../src/profile/copy/en/about';
import { CALIBRATION } from '../../src/profile/evaluation/calibration';
import { RETRIEVAL_PROBES } from '../../src/profile/retrieval-probes';
import { BUNDLE_FORMAT, DOCUMENTS, KNOWLEDGE_DOCUMENTS } from './bundle/layout';
import { makePrivateDir, privateHomeDir, writePrivateFile } from './home';

const REPOSITORY = fileURLToPath(new URL('../..', import.meta.url));
const repositoryFile = (path: string) => readFile(join(REPOSITORY, path));

const { identity, brand, knowledge, siteAllowList, locales, evaluation } = profile;
const { notes, productSites, ...record } = knowledge;

const yaml = (value: unknown) => stringify(value, { lineWidth: 100 });
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** Each record document, from the parts of the record the layout gives it. */
const knowledgeDocuments = Object.fromEntries(
  Object.entries(KNOWLEDGE_DOCUMENTS).map(([document, keys]) => [
    document,
    yaml(Object.fromEntries(keys.map((key) => [key, record[key]]))),
  ]),
);

const assets = [
  { file: 'assets/photo.jpg', path: knowledge.profile.photoUrl, mediaType: 'image/jpeg' },
  { file: 'assets/resume.pdf', path: knowledge.contact.resumeUrl, mediaType: 'application/pdf' },
].filter(({ path }) => path !== null);

const documents: Record<string, string> = {
  [DOCUMENTS.bundle]: yaml({ format: BUNDLE_FORMAT, locales }),
  // The about page names where the site's code is published; as TypeScript it
  // reads that from the copy module, and a bundle holds it with the identity.
  [DOCUMENTS.identity]: yaml({ ...identity, sourceRepository: SOURCE_REPOSITORY }),
  [DOCUMENTS.brand]: yaml({
    ...brand,
    fonts: {
      sans: { face: 'inter', ...brand.fonts.sans },
      display: { face: 'inter-tight', ...brand.fonts.display },
      mono: { face: 'geist-mono', ...brand.fonts.mono },
    },
  }),
  ...knowledgeDocuments,
  [DOCUMENTS.notesGuide]: `${notes.guide}\n`,
  [DOCUMENTS.allowList]: yaml(siteAllowList),
  [DOCUMENTS.cases]: yaml(evaluation),
  [DOCUMENTS.calibration]: yaml(CALIBRATION),
  [DOCUMENTS.probes]: yaml(RETRIEVAL_PROBES),
  [DOCUMENTS.privacy]: yaml({}),
  [DOCUMENTS.assets]: yaml(assets),
  [DOCUMENTS.notes]: json(notes.passages),
};

/** Files the repository already holds as bytes: they move as they are. */
const copied: Record<string, string> = {
  [DOCUMENTS.knowledgeBase]: 'src/profile/knowledge/knowledge-base.md',
  [DOCUMENTS.snapshot]: 'src/profile/sites/snapshot.json',
  [DOCUMENTS.index]: 'src/profile/generated/knowledge-index.json',
  [DOCUMENTS.probeEmbeddings]: 'src/profile/generated/retrieval-probes.json',
  'assets/photo.jpg': `public${knowledge.profile.photoUrl ?? ''}`,
  'assets/resume.pdf': `public${knowledge.contact.resumeUrl ?? ''}`,
};

const bundles = await privateHomeDir(process.env, 'bundles');
const dir = join(bundles, 'owner');
await makePrivateDir(dir);
for (const [path, content] of Object.entries(documents)) {
  await writePrivateFile(join(dir, path), content);
}
for (const [path, source] of Object.entries(copied)) {
  await writePrivateFile(join(dir, path), await repositoryFile(source));
}
console.log(
  `Wrote ${String(Object.keys(documents).length + Object.keys(copied).length)} documents → ${dir}`,
);
console.log(`Check it with: pnpm profile check ${dir}`);
