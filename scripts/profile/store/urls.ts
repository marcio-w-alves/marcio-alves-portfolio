/**
 * Which credential each command uses. Three roles, three variables, and a
 * command that is missing one says which one it needs — never what it holds.
 */

import { ReportedError } from '../reported-error';

export const ADMIN_URL = 'PROFILE_ADMIN_DATABASE_URL';
export const OWNER_URL = 'PROFILE_OWNER_DATABASE_URL';
export const READER_URL = 'PROFILE_DATABASE_URL';

export type Env = Readonly<Record<string, string | undefined>>;

export class MissingUrlError extends ReportedError {}

function urlOf(env: Env, variable: string): string | undefined {
  const value = env[variable];
  return value === undefined || value === '' ? undefined : value;
}

export interface Credential {
  readonly url: string;
  readonly variable: string;
}

/** The database owner's superuser-side credential, used once to create the store. */
export function adminCredential(env: Env): Credential {
  const url = urlOf(env, ADMIN_URL);
  if (url === undefined) {
    throw new MissingUrlError(
      `Creating the profile store needs ${ADMIN_URL}, the connection URL of the database's own ` +
        'owner (Neon shows it in the console). It is used once and then unset.',
    );
  }
  return { url, variable: ADMIN_URL };
}

/** The write credential: the owner's machine only. */
export function ownerCredential(env: Env): Credential {
  const url = urlOf(env, OWNER_URL);
  if (url === undefined) {
    throw new MissingUrlError(
      `Writing to the profile database needs ${OWNER_URL}, the connection URL of the ` +
        'profile_owner role. Only the owner holds it; a build never does.',
    );
  }
  return { url, variable: OWNER_URL };
}

/** A read works with either credential; the read-only one is the one a build holds. */
export function readCredential(env: Env): Credential {
  const reader = urlOf(env, READER_URL);
  if (reader !== undefined) return { url: reader, variable: READER_URL };
  const owner = urlOf(env, OWNER_URL);
  if (owner !== undefined) return { url: owner, variable: OWNER_URL };
  throw new MissingUrlError(
    `Reading the profile database needs ${READER_URL} (the read-only role) or ${OWNER_URL}.`,
  );
}
