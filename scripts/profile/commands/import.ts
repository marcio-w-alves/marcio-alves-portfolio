import { resolve } from 'node:path';
import { decodeBundle } from '../bundle/decode';
import { checkProfile } from '../checks';
import type { Env } from '../store/urls';
import { bundleDirectory } from '../workspace/bundle-directory';
import { headOf } from './head';
import { changeTo, replaceProfile } from './replace-profile';
import { ownerStore } from './store-access';

/**
 * `pnpm profile import <dir> [--note …]` — the bundle becomes the profile.
 *
 * The order is what makes it safe: every check first, so an invalid bundle
 * changes nothing; then a verified backup of what is stored; then one
 * transaction that ends by moving the head. Nothing partial is left behind.
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
  const head = await headOf(store);
  if (head?.revision.digest === revision.digest) {
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
