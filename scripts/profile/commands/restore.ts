import type { Env } from '../store/urls';
import { headToReplace, revisionToRestore } from './head';
import { changeTo, replaceProfile } from './replace-profile';
import { ownerStore } from './store-access';

/**
 * `pnpm profile restore <revision>` — an earlier profile becomes the profile
 * again, as a new revision. The history only ever grows, so restoring is
 * itself something that can be undone.
 *
 * It is also how a head that no longer reads is written over, so it reads both
 * the head and the revision asked for as they are stored. What it cannot do is
 * invent bytes: blobs are shared between revisions, so the revision asked for
 * may hold the very bytes that rotted. Then the restore still leaves a head
 * that reads, and says which documents are not what their revision claims —
 * importing a bundle you hold is the only thing that puts those bytes back.
 */
export async function restoreCommand(
  id: string,
  env: Env,
  log: (line: string) => void,
): Promise<void> {
  const store = ownerStore(env, 'restore');
  const wanted = await revisionToRestore(store, id);
  if (!wanted.snapshot) throw new Error(`Revision ${id} holds no documents.`);
  const { snapshot: head, damaged } = await headToReplace(store);
  if (damaged.length > 0) {
    log(
      `The profile at head does not read back as revision ${String(head?.revision.id)}: ` +
        `${damaged.join(', ')}. Keeping it as it is stored, in a backup marked \`-unverified\`.`,
    );
  }
  if (damaged.length === 0 && head?.revision.digest === wanted.snapshot.revision.digest) {
    log(`Revision ${head.revision.id} already holds that profile; no changes.`);
    return;
  }
  const written = await replaceProfile({
    store,
    env,
    head,
    change: {
      ...changeTo(head, wanted.snapshot.profile.documents, 'restore'),
      note: `restored revision ${wanted.snapshot.revision.id}`,
    },
    log,
  });
  log(
    `Restored revision ${wanted.snapshot.revision.id} as revision ${written.id} ` +
      `(digest ${written.digest.slice(0, 12)}).`,
  );
  if (wanted.damaged.length > 0) {
    log(
      `Revision ${wanted.snapshot.revision.id} does not read back either — ` +
        `${wanted.damaged.join(', ')} ${wanted.damaged.length === 1 ? 'is' : 'are'} not what it ` +
        'claims, because the damaged bytes are shared between revisions. The profile reads ' +
        'again, and those documents hold the bytes as they rotted: import a bundle you hold ' +
        '(`pnpm profile import <dir>`) to put them back.',
    );
  }
}
