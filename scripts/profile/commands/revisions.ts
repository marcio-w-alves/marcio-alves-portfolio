import type { Env } from '../store/urls';
import { readableStore } from './store-access';

/** `pnpm profile revisions` — the history the database keeps, newest first. */
export async function revisionsCommand(env: Env, log: (line: string) => void): Promise<void> {
  const revisions = await readableStore(env, 'revisions').revisions();
  if (revisions.length === 0) {
    log('The database holds no revision yet — import a bundle.');
    return;
  }
  for (const { id, digest, origin, note, createdAt, createdBy, isHead } of revisions) {
    log(
      [
        isHead ? '*' : ' ',
        id.padStart(5),
        digest.slice(0, 12),
        origin.padEnd(12),
        createdAt,
        createdBy,
        note ?? '',
      ]
        .join(' ')
        .trimEnd(),
    );
  }
}
