import { createHash } from 'node:crypto';
import { readFile, rm, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { manifestOf } from '../bundle/digest';
import { exampleCopy, scratchDir, writeDocument, type Scratch } from '../testing/bundles';
import { bundleDirectory, WorkspaceChangedError } from './bundle-directory';
import type { Document } from './workspace';

/**
 * A bundle directory as a workspace: read whole with a digest that changes
 * with any byte, and written only within its layout, only from the revision
 * the change was computed from.
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

const yaml = (text: string): Document => ({
  mediaType: 'application/yaml',
  bytes: new TextEncoder().encode(text),
});
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

describe('a bundle directory, read', () => {
  it('is named by the sha256 of a manifest of its sorted paths, media types and contents', async () => {
    const { revision, profile } = await bundleDirectory(dir).read();
    const manifest = manifestOf(profile.documents);
    const lines = manifest.split('\n');
    const identity = await readFile(join(dir, 'identity.yaml'));

    expect(revision).toEqual({ id: 'dir', digest: sha256(manifest) });
    expect(profile.format).toBe(1);
    expect(lines).toHaveLength(profile.documents.size);
    expect(lines).toEqual([...lines].sort());
    expect(lines).toContain(
      `identity.yaml\tapplication/yaml\t${createHash('sha256').update(identity).digest('hex')}`,
    );
  });

  it('changes its digest when one byte of one document changes, and only then', async () => {
    const before = (await bundleDirectory(dir).read()).revision.digest;
    expect((await bundleDirectory(dir).read()).revision.digest).toBe(before);

    await writeDocument(
      dir,
      'privacy.yaml',
      `${await readFile(join(dir, 'privacy.yaml'), 'utf8')} `,
    );

    expect((await bundleDirectory(dir).read()).revision.digest).not.toBe(before);
  });
});

describe('a bundle directory, written', () => {
  it('puts and removes documents, and reports the revision it now holds', async () => {
    const workspace = bundleDirectory(dir);
    const { revision } = await workspace.read();

    const written = await workspace.write(
      {
        put: new Map([['copy/en/ui.yaml', yaml('emailSubject: Platform role\n')]]),
        remove: ['copy/en/site.yaml'],
        origin: 'import',
      },
      revision,
    );

    expect(await readFile(join(dir, 'copy/en/ui.yaml'), 'utf8')).toBe(
      'emailSubject: Platform role\n',
    );
    expect(written).toEqual((await workspace.read()).revision);
    expect(written.digest).not.toBe(revision.digest);
  });

  it('refuses a change computed from a revision the bundle no longer holds', async () => {
    const workspace = bundleDirectory(dir);
    const { revision } = await workspace.read();
    await writeDocument(dir, 'privacy.yaml', 'phrases: [changed meanwhile]\n');

    await expect(
      workspace.write(
        { put: new Map([['privacy.yaml', yaml('phrases: []\n')]]), remove: [], origin: 'import' },
        revision,
      ),
    ).rejects.toBeInstanceOf(WorkspaceChangedError);
    expect(await readFile(join(dir, 'privacy.yaml'), 'utf8')).toBe(
      'phrases: [changed meanwhile]\n',
    );
  });

  it('refuses to write outside its layout', async () => {
    const workspace = bundleDirectory(dir);
    const { revision } = await workspace.read();

    await expect(
      workspace.write(
        { put: new Map([['../escaped.yaml', yaml('a: 1\n')]]), remove: [], origin: 'import' },
        revision,
      ),
    ).rejects.toThrow('Not part of a profile bundle: ../escaped.yaml');
    await expect(stat(join(scratch.path, 'escaped.yaml'))).rejects.toThrow();
  });

  it('refuses to write through a symbolic link', async () => {
    const outside = join(scratch.path, 'outside.yaml');
    await writeDocument(scratch.path, 'outside.yaml', 'untouched: true\n');
    const workspace = bundleDirectory(dir);
    const { revision } = await workspace.read();
    await rm(join(dir, 'privacy.yaml'));
    await symlink(outside, join(dir, 'privacy.yaml'));

    await expect(
      workspace.write(
        { put: new Map([['privacy.yaml', yaml('phrases: []\n')]]), remove: [], origin: 'import' },
        revision,
      ),
    ).rejects.toThrow();
    expect(await readFile(outside, 'utf8')).toBe('untouched: true\n');
  });
});
