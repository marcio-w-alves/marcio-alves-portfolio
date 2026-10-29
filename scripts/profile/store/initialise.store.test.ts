import { createHash, randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXAMPLE_DIR, runProfile } from '../testing/bundles';
import { withSession } from './connect';
import { createRoleStatement, OWNER_ROLE, READER_ROLE } from './initialise';
import { migrations } from './migrate';
import { ITERATIONS } from './scram';
import {
  ADMIN_URL_VARIABLE,
  assertLocalAdminUrl,
  createTestDatabase,
  expectNoCredential,
  one,
  type TestDatabase,
} from './testing/database';

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

  it('sends the password as a verifier, so no statement carries the plaintext', async () => {
    const password = randomBytes(32).toString('base64url');
    const role = `profile_test_role_${randomBytes(4).toString('hex')}`;
    const asNewRole = new URL(db.adminUrl);
    asNewRole.username = role;
    asNewRole.password = password;

    const sql = await withSession(
      { url: db.adminUrl, variable: ADMIN_URL_VARIABLE, applicationName: 'profile-test' },
      'Building a create-role statement',
      (open) => createRoleStatement(open, role, password),
    );

    // This text is what pg_stat_activity shows, what collected statement
    // statistics keep, and what `log_statement` writes.
    expect(sql).not.toContain(password);
    expect(sql).toContain(`SCRAM-SHA-256$${String(ITERATIONS)}:`);
    // And it is a verifier, not a different password: the role logs in with
    // the plaintext the server never saw.
    await db.query('admin', sql);
    const stored = one(
      await db.query<{ rolpassword: string }>(
        'admin',
        'select rolpassword from pg_authid where rolname = $1',
        [role],
      ),
    );
    expect(stored.rolpassword).toBe(sql.slice(sql.indexOf('SCRAM-SHA-256'), -1));
    await expect(
      withSession(
        {
          url: asNewRole.toString(),
          variable: ADMIN_URL_VARIABLE,
          applicationName: 'profile-test',
        },
        'Logging in as the new role',
        (open) => open.query('select 1 as ok'),
      ),
    ).resolves.toEqual([{ ok: 1 }]);
    await db.query('admin', `drop role ${role}`);
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

  it('does nothing twice when two runs find the schema up to date', async () => {
    const both = await Promise.all([db.asOwner(['migrate']), db.asOwner(['migrate'])]);
    const { applied } = one(
      await db.query<{ applied: number }>(
        'admin',
        'select count(*)::int as applied from profile.schema_migration',
      ),
    );

    expect(both.map(({ code }) => code)).toEqual([0, 0]);
    expect(both.every(({ stdout }) => stdout.includes('already up to date'))).toBe(true);
    expect(applied).toBe((await migrations()).length);
  });

  /**
   * The case the advisory lock is there for: both runs have something to
   * apply. Without it one of them creates the objects and the other fails on
   * what is already there — which is what a first deployment of a new schema
   * looks like when two jobs start together.
   */
  it('applies a pending migration once when two runs start at the same time', async () => {
    const fresh = `${db.name}_pending`;
    await db.query('admin', `create database ${fresh}`);
    const owner = new URL(db.ownerUrl);
    owner.pathname = `/${fresh}`;
    const admin = new URL(db.adminUrl);
    admin.pathname = `/${fresh}`;
    const inFresh = <Row>(url: URL, sql: string) =>
      withSession(
        { url: url.toString(), variable: ADMIN_URL_VARIABLE, applicationName: 'profile-test' },
        'A query against the fresh database',
        (open) => open.query(sql) as Promise<Row[]>,
      );
    await inFresh(admin, `create schema profile authorization ${OWNER_ROLE}`);
    const migrate = () => db.asOwner(['migrate'], { PROFILE_OWNER_DATABASE_URL: owner.toString() });

    const both = await Promise.all([migrate(), migrate()]);

    expect(
      both.map(({ code }) => code),
      both.map(({ stderr }) => stderr).join('\n'),
    ).toEqual([0, 0]);
    // One of them applied it; both are satisfied, and the objects exist once.
    expect(both.filter(({ stdout }) => stdout.includes('Applied'))).toHaveLength(1);
    expect(
      await inFresh<{ applied: number }>(
        owner,
        'select count(*)::int as applied from profile.schema_migration',
      ),
    ).toEqual([{ applied: (await migrations()).length }]);
    expect(
      await inFresh<{ tables: number }>(
        owner,
        `select count(*)::int as tables from pg_tables where schemaname = 'profile'`,
      ),
    ).toEqual([{ tables: 5 }]);
    await db.query('admin', `drop database ${fresh} with (force)`);
  }, 60_000);
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

/**
 * These tests drop databases and roles, and the variable that points them at a
 * database is two words away from the one the owner holds in a shell. So the
 * harness takes only a database it can see is a throw-away.
 */
describe('what the harness will point itself at', () => {
  const remote = 'postgres://neondb_owner:secret@ep-cool-name.eu-central-1.aws.neon.tech/neondb';

  const local = [
    'postgres://postgres:p@localhost:5432/postgres',
    'postgres://postgres:p@127.0.0.1:5432/postgres',
    'postgres://postgres:p@[::1]:5432/postgres',
  ];

  it.each(local)('takes %s, which is on this machine', (url) => {
    expect(() => {
      assertLocalAdminUrl(url, {});
    }).not.toThrow();
  });

  it('refuses a database somewhere else unless it is told to', () => {
    expect(() => {
      assertLocalAdminUrl(remote, {});
    }).toThrow(/destroy roles and databases/);
    expect(() => {
      assertLocalAdminUrl(remote, {});
    }).toThrow(/aws\.neon\.tech/);
    expect(() => {
      assertLocalAdminUrl(remote, { PROFILE_TEST_ALLOW_REMOTE: '1' });
    }).not.toThrow();
  });

  it('refuses a database that already holds a profile', async () => {
    const pointedAt = process.env[ADMIN_URL_VARIABLE];
    // This database holds the example, imported above: a profile, not a fixture.
    process.env[ADMIN_URL_VARIABLE] = db.adminUrl;

    await expect(createTestDatabase()).rejects.toThrow(/already holds a profile/);

    process.env[ADMIN_URL_VARIABLE] = pointedAt;
  });
});
