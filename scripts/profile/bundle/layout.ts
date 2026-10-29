import { SUPPORTED_LOCALES } from '../../../src/core/i18n/locale';

/**
 * What a profile bundle may hold: every path it may contain, the media type
 * each is read as, and the limits that keep a bundle small enough to read in
 * one go. A path outside this layout is a mistake to report, not a file to
 * carry along.
 */

export const BUNDLE_FORMAT = 1;

export type MediaType =
  | 'application/yaml'
  | 'text/markdown'
  | 'application/json'
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

const EXTENSION_MEDIA_TYPES: Readonly<Record<string, MediaType>> = {
  yaml: 'application/yaml',
  md: 'text/markdown',
  json: 'application/json',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const TEXT_MEDIA_TYPES: ReadonlySet<MediaType> = new Set([
  'application/yaml',
  'text/markdown',
  'application/json',
]);

export const LIMITS = {
  documents: 400,
  assetBytes: 10 * 1024 * 1024,
  documentBytes: 25 * 1024 * 1024,
  bundleBytes: 50 * 1024 * 1024,
} as const;

/** Each record document and the parts of the record it holds, as its top-level keys. */
export const KNOWLEDGE_DOCUMENTS = {
  'knowledge/profile.yaml': ['profile', 'welcome', 'assistant', 'contact', 'principles'],
  'knowledge/experience.yaml': ['experience'],
  'knowledge/metrics.yaml': ['metrics'],
  'knowledge/projects.yaml': ['projects'],
  'knowledge/skills.yaml': ['skills', 'certifications'],
  'knowledge/education.yaml': ['education', 'languages'],
  'knowledge/practice.yaml': ['practice'],
  'knowledge/references.yaml': ['references'],
  'knowledge/sources.yaml': ['sourceLabels'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export const DOCUMENTS = {
  bundle: 'bundle.yaml',
  identity: 'identity.yaml',
  brand: 'brand.yaml',
  knowledgeBase: 'knowledge/knowledge-base.md',
  notesGuide: 'knowledge/notes-guide.md',
  allowList: 'sites/allow-list.yaml',
  snapshot: 'sites/snapshot.json',
  cases: 'evaluation/cases.yaml',
  calibration: 'evaluation/calibration.yaml',
  probes: 'retrieval/probes.yaml',
  privacy: 'privacy.yaml',
  assets: 'assets.yaml',
  notes: 'generated/notes.json',
  index: 'generated/knowledge-index.json',
  probeEmbeddings: 'generated/retrieval-probes.json',
} as const;

const FIXED_PATHS: ReadonlySet<string> = new Set([
  ...Object.values(DOCUMENTS),
  ...Object.keys(KNOWLEDGE_DOCUMENTS),
]);

/** A path segment: no leading dot or dash, no spaces, ASCII only. */
export const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const LOCALE = `(${SUPPORTED_LOCALES.join('|')})`;
const NAME = '[A-Za-z0-9][A-Za-z0-9_-]*';
const COPY_DOCUMENT = new RegExp(`^copy/${LOCALE}/(answers/)?${NAME}\\.yaml$`);
// A dot is a name a person gives a file ("photo.v2.jpg"); only the last one picks the format.
const ASSET_FILE = new RegExp(`^assets/[A-Za-z0-9][A-Za-z0-9._-]*\\.(pdf|jpe?g|png|webp)$`);

export function mediaTypeOf(path: string): MediaType | undefined {
  const extension = /\.([a-z]+)$/.exec(path)?.[1];
  return extension === undefined ? undefined : EXTENSION_MEDIA_TYPES[extension];
}

export function isInLayout(path: string): boolean {
  return FIXED_PATHS.has(path) || COPY_DOCUMENT.test(path) || ASSET_FILE.test(path);
}

export function isAsset(path: string): boolean {
  return ASSET_FILE.test(path);
}

/** The locale and the path inside `copy/<locale>/` of a copy document, e.g. `answers/career.yaml`. */
export function copyDocumentOf(path: string): { locale: string; name: string } | undefined {
  const match = /^copy\/([^/]+)\/(.+)$/.exec(path);
  return match?.[1] && match[2] ? { locale: match[1], name: match[2] } : undefined;
}
