import { resolve } from 'node:path';
import { decodeBundle } from '../bundle/decode';
import { checkProfile } from '../checks';
import type { Env } from '../store/urls';
import { bundleDirectory } from '../workspace/bundle-directory';
import { headToReplace } from './head';
import { changeTo, replaceProfile } from './replace-profile';
import { ownerStore } from './store-access';

/**
 * `pnpm profile import <dir> [--note …]` — the bundle becomes the profile.
 *
 * The order is what makes it safe: every check first, so an invalid bundle
 * changes nothing; then a verified backup of what is stored; then one
 * transaction that ends by moving the head. Nothing partial is left behind.
 *
 * It is also the only way back from bytes that rotted, because the bundle is
 * where the right ones are: a blob whose stored bytes no longer hash to its
 * key is replaced by the bundle's, which hash to it. So a damaged head does
 * not stop an import — it is read as it is, kept, and written over.
 */
export async function importCommand(
  dir: string,
  note: string | undefined,
  env: Env,
  log: (line: string) => void,
): Promise<void> {
  const { revision, profile } = await bundleDirectory(resolve(dir)).read();
  checkProfile(decodeBundle(profile.documents));
  const store = ownerStore(env, 'import');
  const { snapshot: head, damaged } = await headToReplace(store);
  if (damaged.length > 0) {
    log(
      `The profile at head does not read back as revision ${String(head?.revision.id)}: ` +
        `${damaged.join(', ')}. Keeping it as it is stored, in a backup marked ` +
        "`-unverified`, and replacing those bytes with the bundle's.",
    );
  }
  if (damaged.length === 0 && head?.revision.digest === revision.digest) {
    log(`The database already holds this profile (revision ${head.revision.id}); no changes.`);
    return;
  }
  const written = await replaceProfile({
    store,
    env,
    head,
    change: {
      ...changeTo(head, profile.documents, 'import'),
      ...(note === undefined ? {} : { note }),
    },
    log,
  });
  log(`Imported ${dir} as revision ${written.id} (digest ${written.digest.slice(0, 12)}).`);
}
