import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Document } from '../workspace/workspace';
import {
  isAsset,
  isInLayout,
  LIMITS,
  mediaTypeOf,
  SEGMENT,
  TEXT_MEDIA_TYPES,
  type MediaType,
} from './layout';
import { ProfileProblemsError, type BundleProblem } from './problems';

/**
 * Reads a bundle directory into its documents, refusing anything the layout
 * does not name, anything the reader could be tricked by (a symlink), and any
 * text the templates would render differently from how it reads (CRLF, a
 * BOM). Every problem is reported, not just the first.
 */

interface Entry {
  readonly path: string;
  readonly size: number;
  readonly mediaType: MediaType;
}

const MiB = 1024 * 1024;
const LAYOUT_GUIDE = 'see profiles/README.md for what a bundle holds';

const MAGIC: Readonly<Partial<Record<MediaType, (bytes: Uint8Array) => boolean>>> = {
  'application/pdf': (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  'image/jpeg': (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  'image/png': (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': (bytes) =>
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50]),
};

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

export async function readBundleDirectory(dir: string): Promise<Map<string, Document>> {
  const problems: BundleProblem[] = [];
  const entries = await listFiles(dir, '', problems);
  problems.push(...sizeProblems(entries));
  const documents = new Map<string, Document>();
  if (problems.length === 0) {
    for (const entry of entries) {
      const document = await readDocument(dir, entry, problems);
      if (document) documents.set(entry.path, document);
    }
  }
  if (problems.length > 0) throw new ProfileProblemsError(problems);
  return documents;
}

async function listFiles(
  root: string,
  prefix: string,
  problems: BundleProblem[],
): Promise<Entry[]> {
  const found: Entry[] = [];
  const names = (await readdir(join(root, prefix))).sort();
  for (const name of names) {
    // Dotfiles are the file system's, not the profile's (.DS_Store, .gitkeep).
    if (name.startsWith('.')) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    const stats = await lstat(join(root, path));
    if (stats.isSymbolicLink()) {
      problems.push({
        document: path,
        problem: 'is a symbolic link',
        remedy: 'put the file itself in the bundle',
      });
    } else if (!SEGMENT.test(name)) {
      problems.push({
        document: path,
        problem: `"${name}" is not a valid name`,
        remedy: 'use letters, digits, ".", "_" and "-", starting with a letter or digit',
      });
    } else if (stats.isDirectory()) {
      found.push(...(await listFiles(root, path, problems)));
    } else {
      const mediaType = isInLayout(path) ? mediaTypeOf(path) : undefined;
      if (mediaType) {
        found.push({ path, size: stats.size, mediaType });
      } else {
        problems.push({
          document: path,
          problem: 'is not part of a profile bundle',
          remedy: LAYOUT_GUIDE,
        });
      }
    }
  }
  return found;
}

function sizeProblems(entries: readonly Entry[]): BundleProblem[] {
  const problems: BundleProblem[] = [];
  if (entries.length > LIMITS.documents) {
    problems.push({
      document: '.',
      problem: `holds ${String(entries.length)} documents; a bundle holds at most ${String(LIMITS.documents)}`,
      remedy: 'merge or remove documents',
    });
  }
  for (const { path, size } of entries) {
    const limit = isAsset(path) ? LIMITS.assetBytes : LIMITS.documentBytes;
    if (size > limit) {
      problems.push({
        document: path,
        problem: `is ${String(size)} bytes; ${isAsset(path) ? 'an asset' : 'a document'} may be at most ${String(limit / MiB)} MiB`,
        remedy: 'make it smaller',
      });
    }
  }
  const total = entries.reduce((sum, { size }) => sum + size, 0);
  if (total > LIMITS.bundleBytes) {
    problems.push({
      document: '.',
      problem: `holds ${String(total)} bytes; a bundle may be at most ${String(LIMITS.bundleBytes / MiB)} MiB`,
      remedy: 'make its assets smaller',
    });
  }
  return problems;
}

async function readDocument(
  root: string,
  { path, mediaType }: Entry,
  problems: BundleProblem[],
): Promise<Document | undefined> {
  const bytes = new Uint8Array(await readFile(join(root, path)));
  const problem = TEXT_MEDIA_TYPES.has(mediaType)
    ? textProblem(bytes)
    : binaryProblem(mediaType, bytes);
  if (problem) {
    problems.push({ document: path, ...problem });
    return undefined;
  }
  return { mediaType, bytes };
}

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function textProblem(bytes: Uint8Array): Omit<BundleProblem, 'document'> | undefined {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    return { problem: 'starts with a byte order mark', remedy: 'save it as UTF-8 without a BOM' };
  }
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    return { problem: 'is not valid UTF-8', remedy: 'save it as UTF-8' };
  }
  if (text.includes('\r')) {
    return { problem: 'has carriage returns (CRLF)', remedy: 'save with LF line endings' };
  }
  return undefined;
}

function binaryProblem(
  mediaType: MediaType,
  bytes: Uint8Array,
): Omit<BundleProblem, 'document'> | undefined {
  if (MAGIC[mediaType]?.(bytes)) return undefined;
  return {
    problem: `does not hold ${mediaType} data, as its extension says`,
    remedy: 'save it in that format, or give it the extension of its format',
  };
}
