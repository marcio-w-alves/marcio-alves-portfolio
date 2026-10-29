import { randomUUID } from 'node:crypto';
import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { bundleFormatOf } from '../bundle/decode';
import { digestOf } from '../bundle/digest';
import { isInLayout, SEGMENT } from '../bundle/layout';
import { readBundleDirectory } from '../bundle/read-directory';
import type { ProfileWorkspace, RevisionChange, WorkspaceRevision } from './workspace';

/** Someone changed the bundle between reading it and writing the change computed from it. */
export class WorkspaceChangedError extends Error {
  constructor(dir: string) {
    super(`The bundle at ${dir} changed since it was read; run the command again.`);
    this.name = 'WorkspaceChangedError';
  }
}

/** A profile bundle on disk: a directory laid out as `profiles/README.md` describes. */
export function bundleDirectory(dir: string): ProfileWorkspace {
  async function read() {
    const documents = await readBundleDirectory(dir);
    return {
      revision: { id: 'dir', digest: digestOf(documents) },
      profile: { format: bundleFormatOf(documents), documents },
    };
  }

  async function write(change: RevisionChange, expected: WorkspaceRevision) {
    const paths = [...change.put.keys(), ...change.remove];
    const outside = paths.filter(
      (path) => !isInLayout(path) || !path.split('/').every((s) => SEGMENT.test(s)),
    );
    if (outside.length > 0) throw new Error(`Not part of a profile bundle: ${outside.join(', ')}`);
    const { revision } = await read();
    if (revision.digest !== expected.digest) throw new WorkspaceChangedError(dir);
    for (const [path, { bytes }] of change.put) await replaceFile(join(dir, path), bytes);
    for (const path of change.remove) await rm(join(dir, path), { force: true });
    return (await read()).revision;
  }

  return { read, write };
}

/** Writes beside the target, then renames over it: a reader sees the old file or the new one. */
async function replaceFile(path: string, bytes: Uint8Array): Promise<void> {
  const existing = await lstat(path).catch(() => undefined);
  if (existing?.isSymbolicLink())
    throw new Error(`Refusing to write through the symbolic link ${path}`);
  await mkdir(dirname(path), { recursive: true });
  // A dotfile, so a concurrent read of the bundle skips it.
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  await writeFile(temporary, bytes);
  await rename(temporary, path);
}
