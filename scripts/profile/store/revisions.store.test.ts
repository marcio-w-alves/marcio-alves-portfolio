import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { digestOf } from '../bundle/digest';
import { readBundleDirectory } from '../bundle/read-directory';
import {
  editDocument,
  EXAMPLE_DIR,
  exampleCopy,
  scratchDir,
  type Scratch,
} from '../testing/bundles';
import { REVISIONS_KEPT } from './profile-store';
import {
  corruptHead,
  createTestDatabase,
  expectNoCredential,
  one,
  type TestDatabase,
} from './testing/database';

/**
 * The history the database keeps: enough of it to undo a mistake, bounded so
 * it cannot grow for ever, and a restore that is itself a new revision — so
 * going back is something that can be gone back on.
 */

let db: TestDatabase;
let scratch: Scratch;

beforeAll(async () => {
  db = await createTestDatabase();
  scratch = await scratchDir('profile-revisions-');
  const imported = await db.asOwner(['import', EXAMPLE_DIR, '--note', 'the example']);
  expect(imported, imported.stderr).toMatchObject({ code: 0 });
}, 120_000);

afterAll(async () => {
  await scratch.remove();
  await db.drop();
});

async function editedBundle(name: string, phrase: string): Promise<string> {
  const dir = await exampleCopy({ path: join(scratch.path, name), remove: scratch.remove });
  await editDocument(dir, 'privacy.yaml', (privacy: { phrases: string[] }) => {
    privacy.phrases = [phrase];
  });
  return dir;
}

/** A revision written in SQL, the way the owner edits a text document by hand. */
async function reviseInSql(text: string, note: string): Promise<string> {
  const [row] = await db.query<{ id: string }>(
    'owner',
    `select profile.revise(jsonb_build_object('put', jsonb_build_object(
              'privacy.yaml', jsonb_build_object(
                'mediaType', 'application/yaml', 'text', $1::text))), $2::text)::text as id`,
    [text, note],
  );
  if (!row) throw new Error('profile.revise returned nothing.');
  return row.id;
}

describe('restoring an earlier profile', () => {
  it('writes it again as a new revision, after backing up what it replaces', async () => {
    const first = await db.counts();
    const edited = await db.asOwner(['import', await editedBundle('edited', 'an edit to undo')]);
    expect(edited, edited.stderr).toMatchObject({ code: 0 });
    const taken = await readdir(join(db.home, 'backups')).catch((): string[] => []);

    const restored = await db.asOwner(['restore', String(first.head)]);

    expect(restored, restored.stderr).toMatchObject({ code: 0 });
    const [revision] = await db.query<{ origin: string; note: string; digest: string }>(
      'admin',
      `select r.origin, r.note, encode(r.digest, 'hex') as digest
         from profile.head h join profile.revision r on r.id = h.revision_id`,
    );
    expect(revision).toMatchObject({
      origin: 'restore',
      note: `restored revision ${String(first.head)}`,
      digest: first.digest,
    });
    const fresh = (await readdir(join(db.home, 'backups'))).filter((name) => !taken.includes(name));
    expect(fresh).toHaveLength(1);
  });

  it('says so when the revision is not one it has', async () => {
    const current = await db.counts();

    const missing = await db.asOwner(['restore', '9999']);
    const nonsense = await db.asOwner(['restore', 'yesterday']);

    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('Revision 9999 not found');
    expect(nonsense.code).toBe(1);
    expect(await db.counts()).toEqual(current);
  });

  it('brings a profile back from a backup on disk', async () => {
    const [newest] = (await readdir(join(db.home, 'backups'))).sort().reverse();
    const backup = join(db.home, 'backups', String(newest));
    const wanted = digestOf(await readBundleDirectory(backup));
    const away = await db.asOwner(['import', await editedBundle('away', 'something else')]);
    expect(away, away.stderr).toMatchObject({ code: 0 });

    const back = await db.asOwner(['import', backup]);

    expect(back, back.stderr).toMatchObject({ code: 0 });
    expect((await db.counts()).digest).toBe(wanted);
  });
});

describe('the digest the database computes in SQL', () => {
  it('is the digest the client computes from the same documents', async () => {
    const id = await reviseInSql('phrases:\n  - edited in sql\n', 'a hand edit');
    const target = join(scratch.path, 'after-sql');

    const exported = await db.asReader(['export', target]);

    expect(exported, exported.stderr).toMatchObject({ code: 0 });
    const [stored] = await db.query<{ client: string; server: string }>(
      'admin',
      `select encode(r.digest, 'hex') as client, encode(profile.digest_of(r.id), 'hex') as server
         from profile.revision r where r.id = $1::bigint`,
      [id],
    );
    expect(stored?.client).toBe(stored?.server);
    expect(digestOf(await readBundleDirectory(target))).toBe(stored?.client);
    expect((await db.counts()).head).toBe(id);
  });

  it('is read back by a build, which re-hashes every byte it was given', async () => {
    const target = join(scratch.path, 'sql-materialize');
    await reviseInSql('phrases:\n  - still valid\n', 'another hand edit');

    const run = await db.asReader(['materialize', '--out', target]);

    expect(run, run.stderr).toMatchObject({ code: 0 });
    const manifest = JSON.parse(
      await readFile(join(target, 'src/profile/generated/manifest.json'), 'utf8'),
    ) as { digest: string; revision: string };
    const { head, digest } = await db.counts();
    expect(manifest).toMatchObject({ revision: head, digest });
  });
});

describe('the bounded history', () => {
  it(`keeps the newest ${String(REVISIONS_KEPT)} revisions and the one at head`, async () => {
    const shared = await db.query<{ sha: string }>(
      'admin',
      `select encode(blob_sha256, 'hex') as sha from profile.document
        where path = 'identity.yaml' and revision_id = (select revision_id from profile.head)`,
    );
    const made: string[] = [];
    for (let edit = 0; edit < REVISIONS_KEPT + 2; edit += 1) {
      made.push(await reviseInSql(`phrases:\n  - revision ${String(edit)}\n`, 'bulk'));
    }
    const pruned = made.slice(0, 2);

    // Pruning happens after a write, so the next import is what collects.
    const imported = await db.asOwner(['import', await editedBundle('after-bulk', 'after bulk')]);

    expect(imported, imported.stderr).toMatchObject({ code: 0 });
    const kept = await db.query<{ id: string }>(
      'admin',
      'select id::text as id from profile.revision order by id desc',
    );
    expect(kept).toHaveLength(REVISIONS_KEPT);
    expect(kept.map(({ id }) => id)).toContain((await db.counts()).head);
    for (const id of pruned) expect(kept.map((row) => row.id)).not.toContain(id);
    // The blobs no revision names any more are gone; the shared ones stayed.
    const orphans = await db.query<{ sha: string }>(
      'admin',
      `select encode(sha256, 'hex') as sha from profile.blob b
        where not exists (select 1 from profile.document d where d.blob_sha256 = b.sha256)`,
    );
    expect(orphans).toEqual([]);
    const stillThere = await db.query<{ sha: string }>(
      'admin',
      `select encode(sha256, 'hex') as sha from profile.blob where sha256 = decode($1, 'hex')`,
      [shared[0]?.sha],
    );
    expect(stillThere).toHaveLength(1);
  });

  it('cannot restore a revision that has been pruned', async () => {
    const { oldest } = one(
      await db.query<{ oldest: string }>(
        'admin',
        'select min(id)::text as oldest from profile.revision',
      ),
    );

    const gone = await db.asOwner(['restore', String(Number(oldest) - 1)]);

    expect(gone.code).toBe(1);
    expect(gone.stderr).toContain('not found');
  });

  /**
   * Pruning is housekeeping after a committed write. Reporting a revision that
   * is live as a failure would send the owner looking for a profile that is
   * already there, or make him import it a second time.
   */
  it('reports a written profile as written even when the pruning fails', async () => {
    await db.query('admin', 'revoke delete on profile.revision from profile_owner');

    const imported = await db.asOwner(['import', await editedBundle('prune-denied', 'unprunable')]);

    await db.query('admin', 'grant delete on profile.revision to profile_owner');
    const { head, digest } = await db.counts();
    expect(imported, imported.stderr).toMatchObject({ code: 0 });
    expect(imported.stdout).toContain(`revision ${String(head)}`);
    expect(imported.stdout).toContain(String(digest).slice(0, 12));
    expect(imported.stdout).toContain('next write will do it');
    expectNoCredential(imported.stdout + imported.stderr, db.ownerUrl);
  });
});

describe('a head that no longer reads', () => {
  it('lists the revisions, so the owner can see what to go back to', async () => {
    const listed = await db.asReader(['revisions']);

    const lines = listed.stdout.trimEnd().split('\n');
    const [first] = lines;
    const ids = lines.map((line) => Number(line.slice(1).trim().split(' ')[0]));
    const { head, digest } = await db.counts();
    expect(listed, listed.stderr).toMatchObject({ code: 0 });
    expect(first?.startsWith('*')).toBe(true);
    expect(first).toContain(String(head));
    expect(first).toContain(String(digest).slice(0, 12));
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
    expect(lines.slice(1).every((line) => line.startsWith(' '))).toBe(true);
    expect(listed.stdout).toContain('profile_owner');
    expect(listed.stdout).toContain('import');
    // Twelve characters of each digest, not the whole of any.
    expect(listed.stdout).not.toContain(String(digest));
    expectNoCredential(listed.stdout + listed.stderr, db.readerUrl);
  });

  /**
   * The document is `identity.yaml`, which no revision here ever edited: under
   * dedup that is ONE blob row, shared by every revision, so the revision a
   * restore goes back to holds the very bytes that rotted. This is the normal
   * case, not the lucky one, and the restore has to leave a head that reads
   * and say what it could not put back.
   */
  it('is written over by a restore, which says which bytes it could not put back', async () => {
    const { head: corruptId } = await db.counts();
    const wanted = one(
      await db.query<{ id: string; digest: string }>(
        'admin',
        `select id::text as id, encode(digest, 'hex') as digest from profile.revision
          where id <> $1::bigint order by id desc limit 1`,
        [corruptId],
      ),
    );
    const taken = await readdir(join(db.home, 'backups')).catch((): string[] => []);
    const corrupted = await corruptHead(db, 'identity.yaml');
    const shared = one(
      await db.query<{ revisions: number }>(
        'admin',
        `select count(distinct revision_id)::int as revisions from profile.document
          where blob_sha256 = decode($1, 'hex')`,
        [corrupted.key],
      ),
    );
    // Nothing that builds will touch it.
    const build = await db.asReader(['materialize', '--out', join(scratch.path, 'corrupt')]);

    const restored = await db.asOwner(['restore', wanted.id]);

    // The damaged blob really is the one the restore target holds too.
    expect(shared.revisions).toBeGreaterThan(1);
    expect(build.code).toBe(1);
    expect(restored, restored.stderr).toMatchObject({ code: 0 });
    expect(restored.stdout).toContain('does not read back as revision');
    expect(restored.stdout).toContain('identity.yaml');
    // It says what it could not do, rather than reporting a clean restore.
    expect(restored.stdout).toContain('does not read back either');
    expect(restored.stdout).toContain('pnpm profile import');
    const [kept] = (await readdir(join(db.home, 'backups'))).filter(
      (name) => !taken.includes(name),
    );
    expect(kept).toMatch(new RegExp(`-rev${String(corruptId)}-unverified$`));
    expect(restored.stdout).toContain(join(db.home, 'backups', String(kept)));
    // And a build works now — before anything is put back by hand.
    const after = await db.asReader(['materialize', '--out', join(scratch.path, 'after-restore')]);
    expect(after, after.stderr).toMatchObject({ code: 0 });
  });

  /**
   * The repair the error names: the bundle is where the right bytes are, and
   * they hash to the key the rotted ones are filed under, so the write heals
   * the row every revision shares.
   */
  it('is put right by importing a bundle, which replaces the bytes that rotted', async () => {
    // From the shipped example, so the damaged key is the one the example's
    // own identity.yaml hashes to — the bytes an import brings back.
    const fresh = await db.asOwner(['import', EXAMPLE_DIR]);
    expect(fresh, fresh.stderr).toMatchObject({ code: 0 });
    const corrupted = await corruptHead(db, 'identity.yaml');
    expect(await corrupted.isSound()).toBe(false);
    const refused = await db.asReader(['materialize', '--out', join(scratch.path, 'rotted')]);

    const imported = await db.asOwner(['import', await editedBundle('healing', 'healed')]);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('import a bundle you hold');
    expect(imported, imported.stderr).toMatchObject({ code: 0 });
    expect(imported.stdout).toContain('does not read back as revision');
    expect(imported.stdout).toContain('identity.yaml');
    // The bytes under that key hash to it again: the damage is gone, not
    // merely stepped around.
    expect(await corrupted.isSound()).toBe(true);
    const after = await db.asReader(['materialize', '--out', join(scratch.path, 'after-import')]);
    expect(after, after.stderr).toMatchObject({ code: 0 });
  });
});
