import { chmod, mkdir, readdir, rm } from 'node:fs/promises';
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
import { ProfileChangedError, profileStore } from './profile-store';
import { OWNER_URL } from './urls';
import { createTestDatabase, type StoreCounts, type TestDatabase } from './testing/database';

/**
 * An import is all or nothing. These tests interrupt one at the moment it is
 * about to move the head — after its backup, after its rows, before it commits
 * — and show that the profile the site would build is still the previous one.
 */

let db: TestDatabase;
let scratch: Scratch;
let before: StoreCounts;

beforeAll(async () => {
  db = await createTestDatabase();
  scratch = await scratchDir('profile-import-');
  const imported = await db.asOwner(['import', EXAMPLE_DIR]);
  expect(imported, imported.stderr).toMatchObject({ code: 0 });
  before = await db.counts();
}, 120_000);

afterAll(async () => {
  await scratch.remove();
  await db.drop();
});

/** A copy of the shipped example under its own name in the scratch directory. */
function copyOfExample(name: string): Promise<string> {
  return exampleCopy({ path: join(scratch.path, name), remove: scratch.remove });
}

/** A copy of the example with one phrase changed, which every check accepts. */
async function editedBundle(name: string, phrase: string): Promise<string> {
  const dir = await copyOfExample(name);
  await editDocument(dir, 'privacy.yaml', (privacy: { phrases: string[] }) => {
    privacy.phrases = [phrase];
  });
  return dir;
}

async function backups(): Promise<string[]> {
  return readdir(join(db.home, 'backups')).catch(() => []);
}

describe('an import that cannot finish', () => {
  it('leaves the previous profile at head when its session is terminated', async () => {
    const held = await db.holdHead();
    const importing = db.startAsOwner(['import', await editedBundle('terminated', 'one')]);
    await db.waitForLockWait('profile-import');

    await db.terminate('profile-import');
    const finished = await importing.finished;
    await held.release();

    expect(finished.code).not.toBe(0);
    // A dropped connection is the kind of failure a read would try again, and
    // a second attempt here would write the profile the owner interrupted: the
    // report says one attempt, and the head still holds the old revision.
    expect(finished.stderr).toContain('after 1 attempt');
    expect(await db.counts()).toEqual(before);
  });

  it('leaves the previous profile at head when the command is killed', async () => {
    const held = await db.holdHead();
    const importing = db.startAsOwner(['import', await editedBundle('killed', 'two')]);
    await db.waitForLockWait('profile-import');

    importing.kill('SIGKILL');
    await importing.finished;
    await held.release();

    expect(await db.counts()).toEqual(before);
    // The profile a build would read is still the one that was there.
    const exported = join(scratch.path, 'after-kill');
    const run = await db.asReader(['export', exported]);
    expect(run, run.stderr).toMatchObject({ code: 0 });
    expect(digestOf(await readBundleDirectory(exported))).toBe(before.digest);
  });
});

describe('two imports at once', () => {
  it('lets one win and tells the other why it did not', async () => {
    const held = await db.holdHead();
    const first = db.startAsOwner(['import', await editedBundle('race-a', 'first')]);
    const second = db.startAsOwner(['import', await editedBundle('race-b', 'second')]);
    await db.waitForLockWait('profile-import');

    await held.release();
    const results = await Promise.all([first.finished, second.finished]);

    const codes = results.map(({ code }) => code).sort();
    expect(codes).toEqual([0, 1]);
    const loser = results.find(({ code }) => code === 1);
    expect(loser?.stderr).toContain('The profile changed since your backup');
    const after = await db.counts();
    expect(after.revisions).toBe(before.revisions + 1);
    const winner = results.find(({ code }) => code === 0);
    expect(winner?.stdout).toContain(after.digest?.slice(0, 12));
  });

  it('refuses a write computed from a head that has moved on', async () => {
    const store = profileStore({ url: db.ownerUrl, variable: OWNER_URL, command: 'stale-test' });
    const stale = await store.read();
    const imported = await db.asOwner(['import', await editedBundle('moved-on', 'moved on')]);
    expect(imported, imported.stderr).toMatchObject({ code: 0 });
    const current = await db.counts();

    await expect(
      store.write({ put: new Map(), remove: ['privacy.yaml'], origin: 'import' }, stale.revision),
    ).rejects.toThrow(ProfileChangedError);

    expect(await db.counts()).toEqual(current);
  });
});

describe('the backup an import takes first', () => {
  it('is on disk, outside the repository, and printed before the first row is written', async () => {
    const held = await db.holdHead();
    const current = await db.counts();
    const taken = await backups();
    const importing = db.startAsOwner(['import', await editedBundle('backed-up', 'backed up')]);
    await db.waitForLockWait('profile-import');

    const printed = importing.output();
    const [fresh] = (await backups()).filter((name) => !taken.includes(name));

    expect(fresh).toBeDefined();
    const backup = join(db.home, 'backups', String(fresh));
    expect(printed).toContain(backup);
    // What it holds is the profile that is about to be replaced.
    expect(digestOf(await readBundleDirectory(backup))).toBe(current.digest);

    await held.release();
    const finished = await importing.finished;
    expect(finished, finished.stderr).toMatchObject({ code: 0 });
  });

  it('stops the import when it cannot be written', async () => {
    const dir = join(db.home, 'backups');
    await mkdir(dir, { recursive: true });
    await chmod(dir, 0o500);
    const current = await db.counts();

    const refused = await db.asOwner(['import', await editedBundle('no-backup', 'no backup')]);

    await chmod(dir, 0o700);
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('could not be backed up');
    expect(await db.counts()).toEqual(current);
  });
});

describe('an invalid bundle', () => {
  it('changes nothing, takes no backup, and names every problem', async () => {
    const broken = await editedBundle('broken', 'broken');
    await editDocument(broken, 'identity.yaml', (identity: { contact: { email?: string } }) => {
      delete identity.contact.email;
    });
    await editDocument(
      broken,
      'knowledge/experience.yaml',
      (record: { experience: { start: string }[] }) => {
        const [first] = record.experience;
        if (first) first.start = 'not a date';
      },
    );
    const current = await db.counts();
    const taken = await backups();

    const refused = await db.asOwner(['import', broken]);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('identity.yaml');
    expect(refused.stderr).toContain('knowledge/experience.yaml');
    expect(refused.stderr).toContain('2 problems');
    expect(await db.counts()).toEqual(current);
    expect(await backups()).toEqual(taken);
  });
});

describe('what an import would change', () => {
  it('names the documents and the ids inside them, and no value', async () => {
    const renamed = await copyOfExample('renamed');
    const probes = await probesOf(renamed);
    const [id] = Object.keys(probes);
    const question = probes[String(id)];
    // The same question under another id: the diff has to name both ids and
    // neither the question.
    await editDocument(renamed, 'retrieval/probes.yaml', (document: Record<string, string>) => {
      Reflect.deleteProperty(document, String(id));
      document.whereSheWorksNow = String(question);
    });
    const current = await db.counts();

    const diffed = await db.asReader(['diff', renamed]);

    expect(diffed, diffed.stderr).toMatchObject({ code: 0 });
    expect(diffed.stdout).toContain('retrieval');
    expect(diffed.stdout).toContain(
      `  retrieval/probes.yaml changed: ${String(id)}, whereSheWorksNow`,
    );
    expect(diffed.stdout).not.toContain(String(question));
    expect(await db.counts()).toEqual(current);
  });

  it('groups an added asset and a removed document by what they are', async () => {
    const changed = await copyOfExample('grouped');
    await rm(join(changed, 'privacy.yaml'));

    const diffed = await db.asReader(['diff', changed]);

    expect(diffed, diffed.stderr).toMatchObject({ code: 0 });
    expect(diffed.stdout).toContain('profile\n  privacy.yaml removed');
  });
});

async function probesOf(dir: string): Promise<Record<string, string>> {
  const documents = await readBundleDirectory(dir);
  const probes = documents.get('retrieval/probes.yaml');
  if (!probes) throw new Error('The example bundle has no probes.');
  const { parse } = await import('yaml');
  return parse(new TextDecoder().decode(probes.bytes)) as Record<string, string>;
}
