import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ReportedError } from '../reported-error';
import type { Document } from '../workspace/workspace';

/**
 * Writes a set of documents out as a bundle directory, byte for byte, so that
 * reading it back gives the same documents and the same digest.
 */

export class TargetNotEmptyError extends ReportedError {
  constructor(dir: string) {
    super(`${dir} already holds files; export into a new directory, or empty this one.`);
  }
}

export async function requireEmptyDirectory(dir: string): Promise<void> {
  const entries = await readdir(dir).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  if (entries.some((name) => !name.startsWith('.'))) throw new TargetNotEmptyError(dir);
}

export interface WriteOptions {
  /** The mode of the files and directories written; the owner's data is private. */
  readonly mode?: number;
}

export async function writeBundleDirectory(
  dir: string,
  documents: ReadonlyMap<string, Document>,
  { mode }: WriteOptions = {},
): Promise<void> {
  await mkdir(dir, { recursive: true, ...(mode === undefined ? {} : { mode: mode | 0o100 }) });
  for (const [path, { bytes }] of documents) {
    const file = join(dir, path);
    await mkdir(dirname(file), {
      recursive: true,
      ...(mode === undefined ? {} : { mode: mode | 0o100 }),
    });
    await writeFile(file, bytes, mode === undefined ? undefined : { mode });
  }
}
