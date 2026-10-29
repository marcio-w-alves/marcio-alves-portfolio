import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { digestOf } from './bundle/digest';
import { readBundleDirectory } from './bundle/read-directory';
import { writeBundleDirectory } from './bundle/write-directory';
import { privateHomeDir } from './home';
import { ReportedError } from './reported-error';
import type { Env } from './store/urls';
import type { ProfileDocuments, WorkspaceRevision } from './workspace/workspace';

/**
 * The copy taken before anything is written over the owner's profile. It is
 * written, read back and hashed before the write begins, so "there is a
 * backup" means a backup that has been verified, not a directory that was
 * created. It lands in `PROFILE_HOME`, which is outside the repository.
 */

const PRIVATE_FILE = 0o600;
const PRIVATE_DIR = 0o700;

export class BackupNotVerifiedError extends ReportedError {
  constructor(path: string) {
    super(
      `The backup written to ${path} does not read back as the profile it was taken from, so ` +
        'nothing was changed. Check the disk and run the command again.',
    );
  }
}

export class BackupNotWrittenError extends ReportedError {
  constructor(cause: unknown) {
    super(
      'The profile could not be backed up, so nothing was changed. The backup goes to ' +
        `PROFILE_HOME/backups: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
}

export interface Snapshot {
  readonly revision: WorkspaceRevision;
  readonly profile: ProfileDocuments;
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[:-]/g, '').replace(/\..*$/, 'Z');
}

/**
 * A directory of its own: two backups taken in the same second — two commands
 * racing for the same profile — must not write into each other.
 */
async function freshDirectory(parent: string, name: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const dir = join(parent, attempt === 0 ? name : `${name}-${randomBytes(3).toString('hex')}`);
    try {
      await mkdir(dir, { recursive: false, mode: PRIVATE_DIR });
      return dir;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}

/** Writes `snapshot` as a bundle under `PROFILE_HOME/backups/`, and returns where. */
export async function writeBackup(env: Env, snapshot: Snapshot, now = new Date()): Promise<string> {
  let dir: string | undefined;
  try {
    const parent = await privateHomeDir(env, 'backups');
    dir = await freshDirectory(parent, `${stamp(now)}-rev${snapshot.revision.id}`);
    await writeBundleDirectory(dir, snapshot.profile.documents, { mode: PRIVATE_FILE });
  } catch (error) {
    if (error instanceof ReportedError) throw error;
    throw new BackupNotWrittenError(error);
  }
  if (digestOf(await readBundleDirectory(dir)) !== snapshot.revision.digest) {
    throw new BackupNotVerifiedError(dir);
  }
  return dir;
}
