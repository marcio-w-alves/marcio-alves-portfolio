import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitEnvironment } from '../../baseline/git-environment';
import { LIMITS } from '../bundle/layout';
import { digestOf } from '../bundle/digest';
import { readBundleDirectory } from '../bundle/read-directory';
import type { Document } from '../workspace/workspace';
import {
  editDocument,
  EXAMPLE_DIR,
  exampleCopy,
  REPOSITORY,
  scratchDir,
  type Scratch,
} from '../testing/bundles';
import { profileStore } from './profile-store';
import { OWNER_URL } from './urls';
import { createTestDatabase, type TestDatabase } from './testing/database';

/**
 * Export, import, export: the profile that comes out of the database is the
 * bundle that went in, byte for byte, and importing it again changes nothing.
 * This is what makes the database a safe single copy of the profile.
 */

let db: TestDatabase;
let scratch: Scratch;

beforeAll(async () => {
  db = await createTestDatabase();
  scratch = await scratchDir('profile-round-trip-');
  const imported = await db.asOwner(['import', EXAMPLE_DIR, '--note', 'the example']);
  expect(imported, imported.stderr).toMatchObject({ code: 0 });
}, 120_000);

afterAll(async () => {
  await scratch.remove();
  await db.drop();
});

const run = promisify(execFile);

/** Every file of a directory with the SHA-256 of its bytes. */
async function fileHashes(dir: string): Promise<Record<string, string>> {
  const names = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = names.filter((entry) => entry.isFile());
  return Object.fromEntries(
    await Promise.all(
      files.map(async (entry) => {
        const path = join(entry.parentPath, entry.name);
        return [
          relative(dir, path),
          createHash('sha256')
            .update(await readFile(path))
            .digest('hex'),
        ] as const;
      }),
    ),
  );
}

describe('the round trip', () => {
  it('exports, re-imports and exports again without changing a byte', async () => {
    const first = join(scratch.path, 'export-a');
    const second = join(scratch.path, 'export-b');
    const before = await db.counts();

    const exportA = await db.asReader(['export', first]);
    const reimport = await db.asOwner(['import', first]);
    const exportB = await db.asReader(['export', second]);

    expect(exportA, exportA.stderr).toMatchObject({ code: 0 });
    expect(reimport, reimport.stderr).toMatchObject({ code: 0 });
    expect(reimport.stdout).toContain('no changes');
    expect(exportB, exportB.stderr).toMatchObject({ code: 0 });
    // Nothing was written: the same head, the same revision, the same blobs.
    expect(await db.counts()).toEqual(before);
    const [a, b, example] = await Promise.all([
      fileHashes(first),
      fileHashes(second),
      fileHashes(EXAMPLE_DIR),
    ]);
    expect(a).toEqual(example);
    expect(b).toEqual(example);
  });

  it('writes no backup when an import would change nothing', async () => {
    const backups = join(db.home, 'backups');

    const again = await db.asOwner(['import', EXAMPLE_DIR]);

    expect(again.stdout).toContain('no changes');
    await expect(readdir(backups)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('makes exactly one revision out of an edited bundle', async () => {
    const edited = await exampleCopy(scratch);
    await editDocument(edited, 'privacy.yaml', (privacy: { phrases: string[] }) => {
      privacy.phrases = ['a different fictional phrase'];
    });
    const before = await db.counts();

    const imported = await db.asOwner(['import', edited, '--note', 'one edit']);

    expect(imported, imported.stderr).toMatchObject({ code: 0 });
    const [revision] = await db.query<{
      id: string;
      origin: string;
      note: string;
      createdBy: string;
      digest: string;
    }>(
      'admin',
      `select r.id::text as id, r.origin, r.note, r.created_by as "createdBy",
              encode(r.digest, 'hex') as digest
         from profile.head h join profile.revision r on r.id = h.revision_id`,
    );
    expect(revision).toMatchObject({
      origin: 'import',
      note: 'one edit',
      createdBy: 'profile_owner',
    });
    expect(await db.counts()).toMatchObject({
      revisions: before.revisions + 1,
      head: revision?.id,
    });
    expect(revision?.digest).toBe(digestOf(await readBundleDirectory(edited)));
  });

  it('keeps a backup of the profile it replaced', async () => {
    const [stamped] = await readdir(join(db.home, 'backups'));
    if (stamped === undefined) throw new Error('The import wrote no backup.');

    const backup = join(db.home, 'backups', stamped);

    expect(await fileHashes(backup)).toEqual(await fileHashes(EXAMPLE_DIR));
  });
});

describe('where an export may land', () => {
  it('leaves the repository untouched when it writes to its default place', async () => {
    const status = await run('git', ['status', '--porcelain'], {
      cwd: REPOSITORY,
      env: gitEnvironment(),
    });

    const exported = await db.asReader(['export']);

    expect(exported, exported.stderr).toMatchObject({ code: 0 });
    expect(exported.stdout).toContain(join(db.home, 'bundles'));
    const after = await run('git', ['status', '--porcelain'], {
      cwd: REPOSITORY,
      env: gitEnvironment(),
    });
    expect(after.stdout).toBe(status.stdout);
  });

  it('refuses a directory that already holds files', async () => {
    const target = join(scratch.path, 'not-empty');

    const first = await db.asReader(['export', target]);
    const second = await db.asReader(['export', target]);

    expect(first, first.stderr).toMatchObject({ code: 0 });
    expect(second.code).toBe(1);
    expect(second.stderr).toContain('already holds files');
  });

  it('refuses to write the profile inside the repository', async () => {
    const inside = join(REPOSITORY, 'profiles', 'exported-by-mistake');

    const refused = await db.asReader(['export', inside]);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('inside the git work tree');
    await expect(readdir(inside)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

/**
 * The store keeps bytes, not text: this profile is nonsense, and that is the
 * point — line endings, normalisation, emoji, an empty file and every byte
 * value have to come back exactly as they went in. It is written through the
 * store rather than the import, which would refuse a profile that says nothing.
 */
describe('a profile of awkward bytes', () => {
  it('comes back byte for byte', async () => {
    const documents = new Map<string, Document>([
      ['bundle.yaml', { mediaType: 'application/yaml', bytes: utf8('format: 1\n') }],
      ['identity.yaml', { mediaType: 'application/yaml', bytes: utf8('name: no final newline') }],
      ['knowledge/notes-guide.md', { mediaType: 'text/markdown', bytes: utf8('') }],
      [
        'knowledge/knowledge-base.md',
        { mediaType: 'text/markdown', bytes: utf8('trailing spaces   \n\n\ttab\n') },
      ],
      [
        'privacy.yaml',
        {
          mediaType: 'application/yaml',
          // The same word composed and decomposed, plus an astral-plane character.
          bytes: utf8('phrases:\n  - "caf\u00e9 cafe\u0301 \u{1f1f5}\u{1f1f9}"\n'),
        },
      ],
      ['assets/all-bytes.pdf', { mediaType: 'application/pdf', bytes: everyByte() }],
      ['assets/large.jpg', { mediaType: 'image/jpeg', bytes: largeJpeg() }],
    ]);
    const store = profileStore({ url: db.ownerUrl, variable: OWNER_URL, command: 'round-trip' });
    const head = await store.read();

    await store.write(
      {
        put: documents,
        remove: [...head.profile.documents.keys()].filter((path) => !documents.has(path)),
        origin: 'import',
        note: 'awkward bytes',
      },
      head.revision,
    );
    const target = join(scratch.path, 'awkward');
    const exported = await db.asReader(['export', target]);

    expect(exported, exported.stderr).toMatchObject({ code: 0 });
    expect(await fileHashes(target)).toEqual(
      Object.fromEntries(
        [...documents].map(([path, { bytes }]) => [
          path,
          createHash('sha256').update(bytes).digest('hex'),
        ]),
      ),
    );
    expect(digestOf(await readBundleDirectory(target))).toBe(digestOf(documents));
  });
});

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function everyByte(): Uint8Array {
  const magic = utf8('%PDF-');
  return new Uint8Array([...magic, ...Array.from({ length: 256 }, (_, byte) => byte)]);
}

function largeJpeg(): Uint8Array {
  const bytes = new Uint8Array(LIMITS.assetBytes);
  bytes.set([0xff, 0xd8, 0xff]);
  for (let at = 3; at < bytes.length; at += 1) bytes[at] = at % 256;
  return bytes;
}
