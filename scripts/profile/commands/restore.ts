import type { Env } from '../store/urls';
import { headOf } from './head';
import { changeTo, replaceProfile } from './replace-profile';
import { ownerStore } from './store-access';

/**
 * `pnpm profile restore <revision>` — an earlier profile becomes the profile
 * again, as a new revision. The history only ever grows, so restoring is
 * itself something that can be undone.
 */
export async function restoreCommand(
  id: string,
  env: Env,
  log: (line: string) => void,
): Promise<void> {
  const store = ownerStore(env, 'restore');
  const wanted = await store.readRevision(id);
  const head = await headOf(store);
  if (head?.revision.digest === wanted.revision.digest) {
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
  });
  log(
    `Restored revision ${wanted.revision.id} as revision ${written.id} ` +
      `(digest ${written.digest.slice(0, 12)}).`,
  );
}
