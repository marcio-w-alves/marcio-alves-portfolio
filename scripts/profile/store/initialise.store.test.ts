import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXAMPLE_DIR, runProfile } from '../testing/bundles';
import { OWNER_ROLE, READER_ROLE } from './initialise';
import { migrations } from './migrate';
import { createTestDatabase, expectNoCredential, one, type TestDatabase } from './testing/database';

/**
 * The store as `pnpm profile init` creates it, against a real Postgres: the
 * two roles and what each may do, the migrations and their checksums, and the
 * immutability the schema itself enforces.
 */

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
}, 120_000);

afterAll(async () => {
  await db.drop();
});

async function sqlStateOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    for (let step: unknown = error; step instanceof Error; step = step.cause) {
      const code = (step as { code?: string }).code;
      if (code !== undefined) return code;
    }
    throw new Error(`The failure carried no SQLSTATE: ${String(error)}`);
  }
  throw new Error('The database accepted a statement it had to refuse.');
}

describe('creating the store', () => {
  it('creates the roles, the schema and the migrations with one command', async () => {
    const roles = await db.query<{ rolname: string; rolcanlogin: boolean; rolsuper: boolean }>(
      'admin',
      'select rolname, rolcanlogin, rolsuper from pg_roles where rolname = any($1) order by rolname',
      [[OWNER_ROLE, READER_ROLE]],
    );
    const applied = await db.query<{ version: number; name: string; checksum: Buffer }>(
      'admin',
      'select version, name, checksum from profile.schema_migration order by version',
    );
    const tables = await db.query<{ tablename: string }>(
      'admin',
      `select tablename from pg_tables where schemaname = 'profile' order by tablename`,
    );

    expect(roles).toEqual([
      { rolname: OWNER_ROLE, rolcanlogin: true, rolsuper: false },
      { rolname: READER_ROLE, rolcanlogin: true, rolsuper: false },
    ]);
    expect(tables.map(({ tablename }) => tablename)).toEqual([
      'blob',
      'document',
      'head',
      'revision',
      'schema_migration',
    ]);
    expect(applied.map(({ version, name, checksum }) => ({ version, name, checksum }))).toEqual(
      (await migrations()).map(({ version, name, checksum }) => ({ version, name, checksum })),
    );
  });

  it('keeps the generated passwords in a file only its owner can read, and prints neither', async () => {
    const path = join(db.home, 'credentials', `${db.host}__${db.name}.env`);
    const file = await readFile(path, 'utf8');
    const { mode } = await stat(path);

    expect(mode & 0o777).toBe(0o600);
    expect(file).toContain(`PROFILE_OWNER_DATABASE_URL=${db.ownerUrl}`);
    expect(file).toContain(`PROFILE_DATABASE_URL=${db.readerUrl}`);
    // 256 bits, which base64url writes in 43 characters.
    expect(new URL(db.ownerUrl).password.length).toBeGreaterThanOrEqual(43);
    expect(new URL(db.readerUrl).password.length).toBeGreaterThanOrEqual(43);
    expectNoCredential(
      db.initialised.stdout + db.initialised.stderr,
      db.ownerUrl,
      db.readerUrl,
      db.adminUrl,
    );
  });

  it('changes nothing when it runs a second time', async () => {
    const before = await db.counts();

    const second = await runProfile(['init'], db.env({ PROFILE_ADMIN_DATABASE_URL: db.adminUrl }));

    expect(second, second.stderr).toMatchObject({ code: 0 });
    expect(second.stdout).toContain('already');
    // The passwords in the credentials file still authenticate.
    expect(await db.query('reader', 'select 1 as ok')).toEqual([{ ok: 1 }]);
    expect(await db.query('owner', 'select 1 as ok')).toEqual([{ ok: 1 }]);
    expect(await db.counts()).toEqual(before);
  });

  it('says what to do when the schema is missing', async () => {
    const { name } = one(
      await db.query<{ name: string }>('admin', 'select current_database() as name'),
    );
    const other = `${name}_bare`;
    await db.query('admin', `create database ${other}`);
    const bare = new URL(db.ownerUrl);
    bare.pathname = `/${other}`;

    const run = await runProfile(
      ['migrate'],
      db.env({ PROFILE_OWNER_DATABASE_URL: bare.toString() }),
    );

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('pnpm profile init');
    await db.query('admin', `drop database ${other} with (force)`);
  });
});

describe('the migrations', () => {
  it('applies each one once, and refuses one whose text has changed', async () => {
    const { version, name } = one(await migrations());

    const upToDate = await db.asOwner(['migrate']);
    await db.query(
      'admin',
      'update profile.schema_migration set checksum = $1 where version = $2',
      [createHash('sha256').update('something else').digest(), version],
    );
    const changed = await db.asOwner(['migrate']);
    await db.query(
      'admin',
      'update profile.schema_migration set checksum = $1 where version = $2',
      [(await migrations())[0]?.checksum, version],
    );

    expect(upToDate, upToDate.stderr).toMatchObject({ code: 0 });
    expect(upToDate.stdout).toContain('already up to date');
    expect(changed.code).toBe(1);
    expect(changed.stderr).toContain(`${String(version).padStart(4, '0')}_${name}.sql`);
  });

  it('applies them once when two runs start at the same time', async () => {
    const both = await Promise.all([db.asOwner(['migrate']), db.asOwner(['migrate'])]);
    const { applied } = one(
      await db.query<{ applied: number }>(
        'admin',
        'select count(*)::int as applied from profile.schema_migration',
      ),
    );

    expect(both.map(({ code }) => code)).toEqual([0, 0]);
    expect(applied).toBe((await migrations()).length);
  });
});

describe('the read-only role', () => {
  beforeAll(async () => {
    const imported = await db.asOwner(['import', EXAMPLE_DIR]);
    expect(imported, imported.stderr).toMatchObject({ code: 0 });
  }, 60_000);

  const writes = [
    {
      what: 'insert into blob',
      sql: `insert into profile.blob (sha256, bytes) values ('\\x00', '')`,
    },
    { what: 'update revision', sql: `update profile.revision set note = 'x'` },
    { what: 'delete a document', sql: 'delete from profile.document' },
    { what: 'move the head', sql: 'update profile.head set revision_id = 1' },
    {
      what: 'insert a revision',
      sql: `insert into profile.revision (digest, bundle_format, origin) values (sha256(''), 1, 'sql')`,
    },
    { what: 'edit through profile.revise', sql: `select profile.revise('{}'::jsonb, 'x')` },
    { what: 'create a table in profile', sql: 'create table profile.mine (id int)' },
    { what: 'create a table in public', sql: 'create table public.mine (id int)' },
    {
      what: 'insert after asking for a writable transaction',
      sql: 'set default_transaction_read_only = off; delete from profile.document',
    },
  ];

  it.each(writes)('refuses the reader when it tries to $what', async ({ sql }) => {
    const before = await db.counts();

    const code = await sqlStateOf(db.query('reader', sql));

    // 25006: the transaction is read-only. 42501: the role has no such right.
    expect(['25006', '42501']).toContain(code);
    expect(await db.counts()).toEqual(before);
  });

  it('lets the reader read the whole profile', async () => {
    const { documents } = one(
      await db.query<{ documents: number }>(
        'reader',
        `select count(*)::int as documents from profile.document d
           join profile.blob b on b.sha256 = d.blob_sha256
           join profile.head h on h.revision_id = d.revision_id`,
      ),
    );

    expect(documents).toBeGreaterThan(20);
  });
});

describe('what the schema itself refuses', () => {
  it('refuses to change a stored revision or document, even for the owner', async () => {
    await expect(db.query('owner', `update profile.revision set note = 'edited'`)).rejects.toThrow(
      /immutable/,
    );
    await expect(
      db.query('owner', `update profile.document set media_type = 'text/markdown'`),
    ).rejects.toThrow(/immutable/);
  });

  const malformed = [
    {
      what: 'a blob whose key is not its hash',
      sql: `insert into profile.blob (sha256, bytes) values (sha256('a'), 'b')`,
    },
    {
      what: 'a document path outside a bundle',
      sql: `insert into profile.document (revision_id, path, media_type, blob_sha256)
              select h.revision_id, '../escape.yaml', 'application/yaml', b.sha256
                from profile.head h, profile.blob b limit 1`,
    },
    {
      what: 'a media type a bundle cannot hold',
      sql: `insert into profile.document (revision_id, path, media_type, blob_sha256)
              select h.revision_id, 'evil.exe', 'application/x-msdownload', b.sha256
                from profile.head h, profile.blob b limit 1`,
    },
  ];

  it.each(malformed)('refuses $what', async ({ sql }) => {
    expect(await sqlStateOf(db.query('owner', sql))).toBe('23514');
  });
});
