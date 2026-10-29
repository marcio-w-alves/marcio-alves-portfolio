import type { Snapshot } from '../backups';
import { CorruptStoreError, type ProfileStore } from '../store/profile-store';
import type { Env } from '../store/urls';
import { headOf } from './head';
import { changeTo, replaceProfile } from './replace-profile';
import { ownerStore } from './store-access';

/**
 * `pnpm profile restore <revision>` — an earlier profile becomes the profile
 * again, as a new revision. The history only ever grows, so restoring is
 * itself something that can be undone.
 *
 * This is also the way out of a head that no longer reads. Everything else
 * refuses a corrupt profile; restore is the command that replaces it, so it
 * keeps the stored bytes as they are — in a backup marked `-unverified`,
 * because they are not what the revision claims — and then writes the revision
 * it was asked for.
 */
export async function restoreCommand(
  id: string,
  env: Env,
  log: (line: string) => void,
): Promise<void> {
  const store = ownerStore(env, 'restore');
  const wanted = await store.readRevision(id);
  const { head, verified } = await headToReplace(store, log);
  if (verified && head?.revision.digest === wanted.revision.digest) {
    log(`Revision ${head.revision.id} already holds that profile; no changes.`);
    return;
  }
  const written = await replaceProfile({
    store,
    env,
    head,
    change: {
      ...changeTo(head, wanted.profile.documents, 'restore'),
      note: `restored revision ${wanted.revision.id}`,
    },
    log,
    backup: { unverified: !verified },
  });
  log(
    `Restored revision ${wanted.revision.id} as revision ${written.id} ` +
      `(digest ${written.digest.slice(0, 12)}).`,
  );
}

interface HeadToReplace {
  readonly head: Snapshot | undefined;
  /** Whether the stored head read back as the profile its revision claims. */
  readonly verified: boolean;
}

async function headToReplace(
  store: ProfileStore,
  log: (line: string) => void,
): Promise<HeadToReplace> {
  try {
    return { head: await headOf(store), verified: true };
  } catch (error) {
    if (!(error instanceof CorruptStoreError)) throw error;
    log(
      'The profile at head does not read back as the revision it claims to be. Restoring over ' +
        'it, and keeping the bytes as they are stored in a backup marked `-unverified`.',
    );
    return { head: await store.readHeadUnverified(), verified: false };
  }
}
