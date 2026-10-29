import { writeBackup, type BackupOptions, type Snapshot } from '../backups';
import { changesBetween } from '../changes';
import { NO_REVISION, type ProfileStore } from '../store/profile-store';
import type { Env } from '../store/urls';
import type {
  Document,
  RevisionChange,
  RevisionOrigin,
  WorkspaceRevision,
} from '../workspace/workspace';

/**
 * Replacing the stored profile with another set of documents — what `import`
 * and `restore` both do. The backup comes first and is verified, so the
 * previous profile is on disk and readable before a single row is written.
 */

/** The change that turns the stored profile into `documents`. */
export function changeTo(
  head: Snapshot | undefined,
  documents: ReadonlyMap<string, Document>,
  origin: RevisionOrigin,
): RevisionChange {
  const stored: ReadonlyMap<string, Document> = head?.profile.documents ?? new Map();
  const put = new Map<string, Document>();
  const remove: string[] = [];
  for (const { path, kind } of changesBetween(stored, documents)) {
    const document = documents.get(path);
    if (kind === 'removed' || !document) remove.push(path);
    else put.set(path, document);
  }
  return { put, remove, origin };
}

export interface Replacement {
  readonly store: ProfileStore;
  readonly env: Env;
  /** What the database holds now, and what the change was computed from. */
  readonly head: Snapshot | undefined;
  readonly change: RevisionChange;
  readonly log: (line: string) => void;
  /** Said in the backup's name and in the line that reports it. */
  readonly backup?: BackupOptions;
}

export async function replaceProfile({
  store,
  env,
  head,
  change,
  log,
  backup,
}: Replacement): Promise<WorkspaceRevision> {
  if (head) {
    const path = await writeBackup(env, head, backup);
    log(`Backed up revision ${head.revision.id} to ${path}.`);
  }
  const written = await store.write(change, head?.revision ?? NO_REVISION);
  await prune(store, log);
  return written;
}

/**
 * Housekeeping, after the profile has changed: the write is committed, so a
 * failure here is not a failed import. Saying so beats reporting a revision
 * that is live as if it had never happened — the next write prunes again.
 */
async function prune(store: ProfileStore, log: (line: string) => void): Promise<void> {
  try {
    await store.prune();
  } catch (error) {
    log(
      'The profile is written. Dropping the oldest revisions did not work this time, so the ' +
        `next write will do it: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
