import type { Snapshot } from '../backups';
import {
  CorruptStoreError,
  EmptyStoreError,
  type ProfileStore,
  type StoredProfile,
} from '../store/profile-store';

/**
 * Reading a profile that is about to be replaced.
 *
 * Everything that builds from the store refuses a revision whose bytes are not
 * what it claims. The two commands that replace a profile cannot: refusing
 * would leave the owner with a damaged head, a backup he never took, and no
 * way to write over either. So they read it as it is, say which documents are
 * not what they claim, and go on — and `replaceProfile` checks afterwards that
 * what they left at head reads.
 */

export async function headOf(store: ProfileStore): Promise<Snapshot | undefined> {
  try {
    return await store.read();
  } catch (error) {
    if (error instanceof EmptyStoreError) return undefined;
    throw error;
  }
}

export interface ProfileToReplace {
  /** Undefined only when the database holds no profile yet. */
  readonly snapshot: Snapshot | undefined;
  readonly damaged: readonly string[];
}

/** The profile at head, damaged or not; nothing when there is none yet. */
export async function headToReplace(store: ProfileStore): Promise<ProfileToReplace> {
  try {
    return { snapshot: await headOf(store), damaged: [] };
  } catch (error) {
    if (!(error instanceof CorruptStoreError)) throw error;
    return asReplaceable(await store.readUnverified());
  }
}

/**
 * One revision, damaged or not. A revision can be damaged through a blob it
 * shares with the head — dedup means one row of bytes serves every revision
 * that holds them — which is exactly when a restore cannot put the profile
 * right and has to say so.
 */
export async function revisionToRestore(
  store: ProfileStore,
  id: string,
): Promise<ProfileToReplace> {
  try {
    return { snapshot: await store.readRevision(id), damaged: [] };
  } catch (error) {
    if (!(error instanceof CorruptStoreError)) throw error;
    return asReplaceable(await store.readUnverified(id));
  }
}

function asReplaceable(stored: StoredProfile): ProfileToReplace {
  return { snapshot: stored, damaged: stored.damaged };
}
