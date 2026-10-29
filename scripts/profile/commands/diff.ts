import { resolve } from 'node:path';
import { changesBetween, describeChanges } from '../changes';
import type { Env } from '../store/urls';
import { bundleDirectory } from '../workspace/bundle-directory';
import type { Document } from '../workspace/workspace';
import { headOf } from './head';
import { readableStore } from './store-access';

/**
 * `pnpm profile diff <dir>` — what importing that bundle would change, by
 * document and by the ids inside it, written nowhere.
 */
export async function diffCommand(
  dir: string,
  env: Env,
  log: (line: string) => void,
): Promise<void> {
  const { profile } = await bundleDirectory(resolve(dir)).read();
  const head = await headOf(readableStore(env, 'diff'));
  const stored: ReadonlyMap<string, Document> = head?.profile.documents ?? new Map();
  const changes = changesBetween(stored, profile.documents);
  if (changes.length === 0) {
    log('Importing this bundle would change nothing.');
    return;
  }
  log(
    `Importing ${dir} would change ${String(changes.length)} ` +
      `document${changes.length === 1 ? '' : 's'}:`,
  );
  for (const line of describeChanges(changes)) log(line);
}
