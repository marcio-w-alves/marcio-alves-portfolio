import { createHash } from 'node:crypto';
import type { Document } from '../workspace/workspace';

const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

function byteOrder(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}

/**
 * One line per document, `path<TAB>media type<TAB>sha256`, sorted by the
 * bytes of the path — the order the database sorts in with `collate "C"`, so
 * both sides compute the same digest.
 */
export function manifestOf(documents: ReadonlyMap<string, Document>): string {
  return [...documents]
    .sort(([a], [b]) => byteOrder(a, b))
    .map(([path, { mediaType, bytes }]) => `${path}\t${mediaType}\t${sha256(bytes)}`)
    .join('\n');
}

/** The sha256 of the manifest: equal digests mean identical profiles. */
export function digestOf(documents: ReadonlyMap<string, Document>): string {
  return sha256(manifestOf(documents));
}
