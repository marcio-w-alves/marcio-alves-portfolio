import { createHash } from 'node:crypto';
import { parseYaml } from './bundle/yaml';
import type { Document } from './workspace/workspace';

/**
 * What one profile holds that another does not — the answer `pnpm profile
 * diff` prints before an import writes anything.
 *
 * It names documents and the ids inside them, never a value: the owner reads
 * this to recognise the edit he made, and the same output has to be safe in a
 * build log.
 */

export type ChangeKind = 'added' | 'changed' | 'removed';

export interface DocumentChange {
  readonly path: string;
  readonly kind: ChangeKind;
  /** For a structured document, the top-level keys that differ. */
  readonly keys: readonly string[];
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function changesBetween(
  before: ReadonlyMap<string, Document>,
  after: ReadonlyMap<string, Document>,
): DocumentChange[] {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return paths.flatMap<DocumentChange>((path) => {
    const old = before.get(path);
    const now = after.get(path);
    if (!old) return [{ path, kind: 'added', keys: topLevelKeys(now) }];
    if (!now) return [{ path, kind: 'removed', keys: [] }];
    if (sha256(old.bytes) === sha256(now.bytes) && old.mediaType === now.mediaType) return [];
    return [{ path, kind: 'changed', keys: differingKeys(old, now) }];
  });
}

/** Where a document belongs, so a reader sees "the record changed", not twelve paths. */
export function groupOf(path: string): string {
  const [first] = path.split('/');
  const locale = /^copy\/([^/]+)\//.exec(path)?.[1];
  if (locale !== undefined) return `copy (${locale})`;
  switch (first) {
    case 'knowledge':
      return 'record';
    case 'generated':
      return 'generated files';
    case 'assets':
      return 'assets';
    case 'sites':
      return 'product sites';
    case 'evaluation':
      return 'evaluation';
    case 'retrieval':
      return 'retrieval';
    default:
      return 'profile';
  }
}

/** The lines the commands print: one group heading, then one line per document. */
export function describeChanges(changes: readonly DocumentChange[]): string[] {
  const groups = new Map<string, DocumentChange[]>();
  for (const change of changes) {
    const group = groupOf(change.path);
    groups.set(group, [...(groups.get(group) ?? []), change]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([group, members]) => [
      group,
      ...members.map(
        ({ path, kind, keys }) =>
          `  ${path} ${kind}${keys.length === 0 ? '' : `: ${keys.join(', ')}`}`,
      ),
    ]);
}

function structure(document: Document | undefined): Record<string, unknown> | undefined {
  if (!document) return undefined;
  const text = new TextDecoder().decode(document.bytes);
  const value: unknown =
    document.mediaType === 'application/yaml'
      ? yamlValue(text)
      : document.mediaType === 'application/json'
        ? jsonValue(text)
        : undefined;
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function yamlValue(text: string): unknown {
  const parsed = parseYaml('.', text);
  return parsed.ok ? parsed.value : undefined;
}

function jsonValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function topLevelKeys(document: Document | undefined): string[] {
  return Object.keys(structure(document) ?? {}).sort();
}

/**
 * The top-level keys whose content differs — answer ids, role ids, the parts
 * of the record. A document no structure can be read from (a PDF, prose, or
 * one that no longer parses) differs as a whole.
 */
function differingKeys(before: Document, after: Document): string[] {
  const old = structure(before);
  const now = structure(after);
  if (!old || !now) return [];
  const keys = [...new Set([...Object.keys(old), ...Object.keys(now)])].sort();
  return keys.filter((key) => JSON.stringify(old[key]) !== JSON.stringify(now[key]));
}
