import { readdir, rm, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  exampleCopy,
  problemsOf,
  scratchDir,
  writeDocument,
  type Scratch,
} from '../testing/bundles';
import { LIMITS } from './layout';

/**
 * A bundle is read only as its layout says: unknown paths, symlinks, odd
 * names, text the templates would render differently and oversized or
 * mislabelled files are refused, each named, all in one report.
 */

let scratch: Scratch;
let dir: string;

beforeEach(async () => {
  scratch = await scratchDir();
  dir = await exampleCopy(scratch);
});
afterEach(async () => {
  await scratch.remove();
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PDF = Buffer.from('%PDF-1.7\n');

describe('a bundle directory', () => {
  it('reads the example as it ships', async () => {
    expect(await problemsOf(dir)).toEqual([]);
  });

  it('refuses a path outside the layout, naming it', async () => {
    await writeDocument(dir, 'notes/todo.yaml', 'a: 1\n');

    expect(await problemsOf(dir)).toEqual([
      'notes/todo.yaml: is not part of a profile bundle — see profiles/README.md for what a bundle holds',
    ]);
  });

  it('ignores dotfiles the file system leaves behind', async () => {
    await writeDocument(dir, '.DS_Store', 'junk');
    await writeDocument(dir, 'knowledge/.DS_Store', 'junk');

    expect(await problemsOf(dir)).toEqual([]);
  });

  it('refuses a symbolic link, even to a file of the bundle', async () => {
    await rm(join(dir, 'privacy.yaml'));
    await symlink(join(dir, 'identity.yaml'), join(dir, 'privacy.yaml'));

    expect(await problemsOf(dir)).toEqual([
      'privacy.yaml: is a symbolic link — put the file itself in the bundle',
    ]);
  });

  it.each(['-a.yaml', 'a b.yaml', 'ä.yaml', 'a~b.yaml'])('refuses the name "%s"', async (name) => {
    await writeDocument(dir, `copy/en/answers/${name}`, 'a: 1\n');

    const [problem] = await problemsOf(dir);
    expect(problem).toContain(`copy/en/answers/${name}`);
    expect(problem).toMatch(/is not a valid name|is not part of a profile bundle/);
  });

  it('reports every problem of a directory, not the first', async () => {
    await writeDocument(dir, 'one.txt', 'x');
    await writeDocument(dir, 'two.txt', 'x');

    expect(await problemsOf(dir)).toHaveLength(2);
  });
});

describe('the text of a bundle', () => {
  it('refuses CRLF line endings, saying how to save the file', async () => {
    await writeDocument(dir, 'privacy.yaml', 'phrases:\r\n  - a phrase\r\n');

    expect(await problemsOf(dir)).toEqual([
      'privacy.yaml: has carriage returns (CRLF) — save with LF line endings',
    ]);
  });

  it('refuses a byte order mark', async () => {
    await writeDocument(dir, 'privacy.yaml', '﻿phrases: []\n');

    expect(await problemsOf(dir)).toEqual([
      'privacy.yaml: starts with a byte order mark — save it as UTF-8 without a BOM',
    ]);
  });

  it('refuses text that is not UTF-8', async () => {
    await writeDocument(dir, 'privacy.yaml', Buffer.from([0x61, 0x3a, 0x20, 0xc3, 0x28, 0x0a]));

    expect(await problemsOf(dir)).toEqual(['privacy.yaml: is not valid UTF-8 — save it as UTF-8']);
  });
});

async function bundleBytes(): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { recursive: true })) {
    const stats = await stat(join(dir, entry));
    if (stats.isFile()) total += stats.size;
  }
  return total;
}

/** A JPEG of exactly `size` bytes: valid magic bytes, then padding. */
const jpegOf = (size: number) => Buffer.concat([JPEG, Buffer.alloc(size - JPEG.length)]);

describe('the limits of a bundle', () => {
  const answers = (count: number) =>
    Promise.all(
      Array.from({ length: count }, (_, index) =>
        writeDocument(dir, `copy/en/answers/a${String(index)}.yaml`, 'a: 1\n'),
      ),
    );

  it('reads up to 400 documents and refuses the 401st', async () => {
    // English alone, so the filler is one document each rather than a pair
    // the translation check would hold to its English twin. The example's
    // Portuguese copy goes with the language it was written for.
    await writeDocument(dir, 'bundle.yaml', 'format: 1\nlocales: [en]\n');
    await rm(join(dir, 'copy', 'pt-BR'), { recursive: true });
    const shipped = (await readdir(dir, { recursive: true, withFileTypes: true })).filter((entry) =>
      entry.isFile(),
    ).length;
    await answers(LIMITS.documents - shipped);
    expect(await problemsOf(dir)).toEqual([]);

    await writeDocument(dir, 'copy/en/answers/one-more.yaml', 'a: 1\n');
    expect(await problemsOf(dir)).toEqual([
      '.: holds 401 documents; a bundle holds at most 400 — merge or remove documents',
    ]);
  });

  it('reads an asset of 10 MiB and refuses one a byte larger', async () => {
    await writeDocument(dir, 'assets/ada-rivera.jpg', jpegOf(LIMITS.assetBytes));
    expect(await problemsOf(dir)).toEqual([]);

    await writeDocument(dir, 'assets/ada-rivera.jpg', jpegOf(LIMITS.assetBytes + 1));
    expect(await problemsOf(dir)).toEqual([
      `assets/ada-rivera.jpg: is ${String(LIMITS.assetBytes + 1)} bytes; an asset may be at most 10 MiB — make it smaller`,
    ]);
  });

  it('refuses a document a byte over 25 MiB', async () => {
    await writeDocument(dir, 'sites/snapshot.json', Buffer.alloc(LIMITS.documentBytes + 1, 0x20));

    expect(await problemsOf(dir)).toEqual([
      `sites/snapshot.json: is ${String(LIMITS.documentBytes + 1)} bytes; a document may be at most 25 MiB — make it smaller`,
    ]);
  });

  it('reads a bundle of 50 MiB and refuses one a byte larger', async () => {
    const assets = ['b1', 'b2', 'b3', 'b4'];
    for (const name of assets)
      await writeDocument(dir, `assets/${name}.jpg`, jpegOf(LIMITS.assetBytes));
    await writeDocument(dir, 'assets/b5.jpg', jpegOf(LIMITS.bundleBytes - (await bundleBytes())));
    const sizeProblems = async () =>
      (await problemsOf(dir)).filter((line) => line.startsWith('.:'));
    expect(await sizeProblems()).toEqual([]);

    await writeDocument(dir, 'assets/b6.jpg', jpegOf(JPEG.length + 1));
    expect(await sizeProblems()).toEqual([
      `.: holds ${String(LIMITS.bundleBytes + JPEG.length + 1)} bytes; a bundle may be at most 50 MiB — make its assets smaller`,
    ]);
  });

  it('refuses a GIF, which the site does not serve', async () => {
    await writeDocument(dir, 'assets/photo.gif', Buffer.from('GIF89a'));

    expect(await problemsOf(dir)).toEqual([
      'assets/photo.gif: is not part of a profile bundle — see profiles/README.md for what a bundle holds',
    ]);
  });

  it('refuses a file whose bytes are not the format its extension names', async () => {
    await writeDocument(dir, 'assets/ada-rivera-cv.pdf', JPEG);
    await writeDocument(dir, 'assets/ada-rivera.jpg', PDF);

    expect(await problemsOf(dir)).toEqual([
      'assets/ada-rivera-cv.pdf: does not hold application/pdf data, as its extension says — save it in that format, or give it the extension of its format',
      'assets/ada-rivera.jpg: does not hold image/jpeg data, as its extension says — save it in that format, or give it the extension of its format',
    ]);
  });
});
