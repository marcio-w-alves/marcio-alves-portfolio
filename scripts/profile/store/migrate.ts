import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReportedError } from '../reported-error';
import type { Session } from './connect';

/**
 * The schema's migrations: numbered SQL files applied in order, once, each
 * recorded with the checksum of the file that was applied. An edited file that
 * has already run is a mistake to report — the database would no longer match
 * the migration anyone else applies.
 */

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const FILE_NAME = /^(\d{4})_([a-z0-9_]+)\.sql$/;

/** One number, so two runners cannot apply the same migration at once. */
const ADVISORY_LOCK = 8_163_264;

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: Buffer;
}

export class MigrationChangedError extends ReportedError {
  constructor(version: number, name: string) {
    super(
      `Migration ${String(version).padStart(4, '0')}_${name}.sql has already been applied, and ` +
        'its text has changed since. A migration is never edited: add the next one instead, and ' +
        'restore this file to the text that was applied.',
    );
  }
}

export class SchemaMissingError extends ReportedError {
  constructor() {
    super('The database has no `profile` schema yet. Run `pnpm profile init` first.');
  }
}

/** `0001_profile_store.sql` → its number and its name; anything else is not a migration. */
function numbered(file: string): { version: number; name: string } | undefined {
  const [, version, name] = FILE_NAME.exec(file) ?? [];
  if (version === undefined || name === undefined) return undefined;
  return { version: Number(version), name };
}

export async function migrations(): Promise<Migration[]> {
  const files = (await readdir(MIGRATIONS_DIR)).sort();
  return Promise.all(
    files.flatMap((file) => {
      const migration = numbered(file);
      return migration === undefined ? [] : [read(file, migration)];
    }),
  );
}

async function read(
  file: string,
  { version, name }: { version: number; name: string },
): Promise<Migration> {
  const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
  return { version, name, sql, checksum: createHash('sha256').update(sql).digest() };
}

const MIGRATION_TABLE = `create table if not exists profile.schema_migration (
  version    integer primary key,
  name       text not null,
  checksum   bytea not null,
  applied_at timestamptz not null default now()
)`;

interface AppliedRow {
  readonly version: number;
  readonly name: string;
  readonly checksum: Buffer;
}

/**
 * Applies every migration the database has not seen, in one transaction, with
 * the other runners waiting on an advisory lock. Returns the ones it applied.
 */
export async function applyMigrations(open: Session): Promise<Migration[]> {
  const pending = await open.transaction('read committed', async () => {
    await open.query('select pg_advisory_xact_lock($1::bigint)', [ADVISORY_LOCK]);
    const [schema] = await open.query(
      `select 1 from pg_catalog.pg_namespace where nspname = 'profile'`,
    );
    if (!schema) throw new SchemaMissingError();
    await open.query(MIGRATION_TABLE);
    const applied = new Map(
      (
        await open.query<AppliedRow>('select version, name, checksum from profile.schema_migration')
      ).map((row) => [row.version, row]),
    );
    const outstanding: Migration[] = [];
    for (const migration of await migrations()) {
      const seen = applied.get(migration.version);
      if (!seen) {
        outstanding.push(migration);
      } else if (!seen.checksum.equals(migration.checksum)) {
        throw new MigrationChangedError(migration.version, seen.name);
      }
    }
    for (const { version, name, sql, checksum } of outstanding) {
      await open.query(sql);
      await open.query(
        'insert into profile.schema_migration (version, name, checksum) values ($1::int, $2, $3)',
        [version, name, checksum],
      );
    }
    return outstanding;
  });
  return pending;
}
