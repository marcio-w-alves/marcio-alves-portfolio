import { writeBackup, type Snapshot } from '../backups';
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
}

export async function replaceProfile({
  store,
  env,
  head,
  change,
  log,
}: Replacement): Promise<WorkspaceRevision> {
  if (head) log(`Backed up revision ${head.revision.id} to ${await writeBackup(env, head)}.`);
  const written = await store.write(change, head?.revision ?? NO_REVISION);
  await store.prune();
  return written;
}
