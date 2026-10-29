import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { privateHomeDir, writePrivateFile } from '../home';
import { withSession, type Session } from './connect';
import { applyMigrations } from './migrate';
import type { Credential, Env } from './urls';
import { OWNER_URL, READER_URL } from './urls';

/**
 * Creating the store from an empty database, with one command: the two roles,
 * the schema they own and read, and the migrations. Run again, it changes
 * nothing — no password, no data — and says so.
 *
 * The passwords it generates are written to a file only its owner can read and
 * are never printed: a terminal's scrollback is not a password manager.
 */

export const OWNER_ROLE = 'profile_owner';
export const READER_ROLE = 'profile_reader';
/** 256 bits, in the characters a URL carries without escaping. */
const PASSWORD_BYTES = 32;
/** The reader is a build, and a build opens one connection at a time. */
const READER_CONNECTIONS = 5;

export interface Initialised {
  /** The file the generated credentials were written to, if any were generated. */
  readonly credentialsPath?: string;
  readonly rolesCreated: readonly string[];
  readonly migrationsApplied: readonly number[];
}

export async function initialiseStore(
  { url, variable }: Credential,
  env: Env,
  log: (line: string) => void,
): Promise<Initialised> {
  return withSession(
    { url, variable, applicationName: 'profile-init' },
    'Creating the profile store',
    async (open) => {
      const passwords = new Map<string, string>();
      const rolesCreated: string[] = [];
      for (const role of [OWNER_ROLE, READER_ROLE]) {
        const password = randomBytes(PASSWORD_BYTES).toString('base64url');
        if (await createRole(open, role, password)) {
          rolesCreated.push(role);
          passwords.set(role, password);
        }
      }
      await grantRoles(open);
      await closePublicSchema(open, log);
      await open.query(`set role ${OWNER_ROLE}`);
      const applied = await applyMigrations(open);
      await open.query('reset role');

      const credentialsPath =
        passwords.size === 0 ? undefined : await writeCredentials(url, passwords, env);
      report(
        { rolesCreated, applied: applied.map(({ version }) => version), credentialsPath },
        log,
      );
      return {
        rolesCreated,
        migrationsApplied: applied.map(({ version }) => version),
        ...(credentialsPath === undefined ? {} : { credentialsPath }),
      };
    },
  );
}

function report(
  {
    rolesCreated,
    applied,
    credentialsPath,
  }: {
    rolesCreated: readonly string[];
    applied: readonly number[];
    credentialsPath: string | undefined;
  },
  log: (line: string) => void,
) {
  log(
    rolesCreated.length === 0
      ? `The roles ${OWNER_ROLE} and ${READER_ROLE} are already there; their passwords are unchanged.`
      : `Created the role${rolesCreated.length === 1 ? '' : 's'} ${rolesCreated.join(' and ')}.`,
  );
  log(
    applied.length === 0
      ? 'The schema is already up to date.'
      : `Applied migration${applied.length === 1 ? '' : 's'} ${applied.join(', ')}.`,
  );
  if (credentialsPath !== undefined) {
    log(`The generated passwords are in ${credentialsPath} (readable by you alone).`);
    log(`Copy ${OWNER_URL} into your .env.local, and ${READER_URL} into the deployment.`);
  } else if (rolesCreated.length === 0) {
    log(
      `This database is already initialised. If you need the passwords, set new ones with ` +
        `\`alter role ${READER_ROLE} password …\` and update the deployment.`,
    );
  }
}

/** Whether the role was created; an existing role keeps the password it has. */
async function createRole(open: Session, role: string, password: string): Promise<boolean> {
  const [existing] = await open.query('select 1 from pg_catalog.pg_roles where rolname = $1', [
    role,
  ]);
  if (existing) return false;
  // Postgres quotes the identifier and the literal, so the generated password
  // is never spliced into SQL by hand.
  await open.query(await statement(open, 'create role %I login password %L', [role, password]));
  return true;
}

async function grantRoles(open: Session): Promise<void> {
  await open.query(
    await statement(open, 'grant connect on database %I to %I, %I', [
      await currentDatabase(open),
      OWNER_ROLE,
      READER_ROLE,
    ]),
  );
  await open.query(`create schema if not exists profile authorization ${OWNER_ROLE}`);
  await open.query(`grant usage on schema profile to ${READER_ROLE}`);
  await open.query(`alter role ${READER_ROLE} connection limit ${String(READER_CONNECTIONS)}`);
  // Read-only by default, so a mistake cannot be a write even before the grants
  // refuse it, and a slow statement cannot hold a build open.
  await open.query(`alter role ${READER_ROLE} set default_transaction_read_only = on`);
  await open.query(`alter role ${READER_ROLE} set statement_timeout = '15s'`);
}

/**
 * Nobody creates anything in `public`: the profile lives in its own schema.
 * Postgres 15 and later start out this way, and a managed database may not let
 * its owner change it, so a refusal is reported rather than fatal.
 */
async function closePublicSchema(open: Session, log: (line: string) => void): Promise<void> {
  try {
    await open.query('revoke create on schema public from public');
  } catch (error) {
    if ((error as { code?: string }).code !== '42501') throw error;
    log('Could not revoke create on schema public (this role does not own it); check it by hand.');
  }
}

/** SQL the server itself assembled, with every identifier and literal quoted by it. */
async function statement(
  open: Session,
  format: string,
  values: readonly string[],
): Promise<string> {
  const parameters = values.map((_, index) => `$${String(index + 1)}::text`).join(', ');
  const [row] = await open.query<{ sql: string }>(
    `select format('${format}', ${parameters}) as sql`,
    values,
  );
  if (!row) throw new Error('The database assembled no statement.');
  return row.sql;
}

async function currentDatabase(open: Session): Promise<string> {
  const [row] = await open.query<{ name: string }>('select current_database() as name');
  if (!row) throw new Error('The database did not say which database it is.');
  return row.name;
}

/**
 * The two connection URLs, in `PROFILE_HOME/credentials/<host>__<database>.env`.
 * The file is the only copy of the generated passwords.
 */
async function writeCredentials(
  adminUrl: string,
  passwords: ReadonlyMap<string, string>,
  env: Env,
): Promise<string> {
  const parsed = new URL(adminUrl);
  const dir = await privateHomeDir(env, 'credentials');
  const database = parsed.pathname.replace(/^\//, '');
  const path = join(dir, `${parsed.hostname}__${database || 'postgres'}.env`);
  const lines = [
    `# ${OWNER_ROLE} writes the profile; keep it on your machine only.`,
    ...roleLine(OWNER_URL, OWNER_ROLE, parsed, passwords),
    `# ${READER_ROLE} is read-only; this is the one a build and CI hold.`,
    ...roleLine(READER_URL, READER_ROLE, parsed, passwords),
  ];
  await writePrivateFile(path, `${lines.join('\n')}\n`);
  return path;
}

function roleLine(
  variable: string,
  role: string,
  parsed: URL,
  passwords: ReadonlyMap<string, string>,
): string[] {
  const password = passwords.get(role);
  if (password === undefined)
    return [`# ${variable}: ${role} already existed; its password stands.`];
  const url = new URL(parsed.toString());
  url.username = role;
  url.password = password;
  return [`${variable}=${url.toString()}`];
}
