import { profileStore } from '../store/profile-store';
import { READER_URL } from '../store/urls';
import type { ProfileWorkspace } from './workspace';

/**
 * The profile database as a workspace. The build reads it with the read-only
 * credential; the scripts that write a profile take the owner's one, and say
 * so themselves.
 */
export function databaseWorkspace(url: string, command: string): ProfileWorkspace {
  return profileStore({ url, variable: READER_URL, command });
}
