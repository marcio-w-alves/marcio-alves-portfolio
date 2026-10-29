import type { Snapshot } from '../backups';
import { EmptyStoreError, type ProfileStore } from '../store/profile-store';

/**
 * The profile at head, or nothing when the database holds none yet. A command
 * that is about to write one needs to tell those apart; a command that is
 * about to read one fails, and `EmptyStoreError` says what to do.
 */
export async function headOf(store: ProfileStore): Promise<Snapshot | undefined> {
  try {
    return await store.read();
  } catch (error) {
    if (error instanceof EmptyStoreError) return undefined;
    throw error;
  }
}
