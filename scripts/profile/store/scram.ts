import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

/**
 * A SCRAM-SHA-256 verifier, computed here so that a generated password never
 * leaves this process.
 *
 * `create role … password '<plaintext>'` is a statement, and a statement is
 * data the server keeps and shows: `pg_stat_activity.query`, the statement
 * statistics a managed Postgres may collect, and the log under
 * `log_statement = ddl`. Postgres accepts a ready-made verifier in the same
 * place, so what travels is the hash, and the log we do not control holds
 * nothing worth stealing.
 *
 * RFC 5802 §3, which Postgres stores as
 * `SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>` (base64).
 */

export const ITERATIONS = 4096;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const hmac = (key: Buffer, text: string) => createHmac('sha256', key).update(text).digest();

/**
 * The password is used as-is: SASLprep (RFC 4013) only has anything to do on
 * passwords outside printable ASCII, and the ones this tool generates are
 * base64url.
 */
export function scramVerifier(password: string, salt: Buffer = randomBytes(SALT_BYTES)): string {
  const saltedPassword = pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, 'sha256');
  const storedKey = createHash('sha256').update(hmac(saltedPassword, 'Client Key')).digest();
  const serverKey = hmac(saltedPassword, 'Server Key');
  return (
    `SCRAM-SHA-256$${String(ITERATIONS)}:${salt.toString('base64')}` +
    `$${storedKey.toString('base64')}:${serverKey.toString('base64')}`
  );
}
