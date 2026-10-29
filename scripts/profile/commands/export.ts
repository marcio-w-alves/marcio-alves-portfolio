import { join } from 'node:path';
import { requireEmptyDirectory, writeBundleDirectory } from '../bundle/write-directory';
import { privateHomeDir } from '../home';
import { readCredential, type Env } from '../store/urls';
import { hostOf, readableStore, writableTarget } from './store-access';

/**
 * `pnpm profile export [dir]` — the profile at head, written out as a bundle,
 * byte for byte, so the owner can edit it and import it back. Without a
 * directory it lands in `PROFILE_HOME/bundles/`, outside the repository.
 */
export async function exportCommand(
  dir: string | undefined,
  env: Env,
  log: (line: string) => void,
): Promise<void> {
  const credential = readCredential(env);
  const { revision, profile } = await readableStore(env, 'export').read();
  const target =
    dir === undefined
      ? join(await privateHomeDir(env, 'bundles'), `${hostOf(credential)}-rev${revision.id}`)
      : writableTarget(dir);
  await requireEmptyDirectory(target);
  await writeBundleDirectory(target, profile.documents, { mode: 0o600 });
  log(
    `Exported revision ${revision.id} (digest ${revision.digest.slice(0, 12)}, ` +
      `${String(profile.documents.size)} documents) to ${target}.`,
  );
}
