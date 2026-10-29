import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { digestOf, manifestOf } from './digest';
import type { Document } from '../workspace/workspace';

/**
 * The digest is how a bundle on disk and a revision in the database are
 * compared without comparing every byte, so the two sides have to agree
 * exactly — including the order the paths are listed in, which Postgres gives
 * with `collate "C"`: by the bytes of the path, not by any locale's alphabet.
 */

const yaml = (text: string): Document => ({
  mediaType: 'application/yaml',
  bytes: new TextEncoder().encode(text),
});

describe('the manifest the digest is taken of', () => {
  it('lists one line per document, with its media type and the hash of its bytes', () => {
    const documents = new Map([['identity.yaml', yaml('name: Ada\n')]]);
    const hash = createHash('sha256').update('name: Ada\n').digest('hex');

    expect(manifestOf(documents)).toBe(`identity.yaml\tapplication/yaml\t${hash}`);
  });

  it('sorts the paths by their bytes, as the database does', () => {
    const paths = ['a.yaml', 'B.yaml', 'a-b.yaml', 'a_b.yaml', 'copy/en/x.yaml', 'copy.yaml'];
    const documents = new Map(paths.map((path) => [path, yaml(path)]));

    const listed = manifestOf(documents)
      .split('\n')
      .map((line) => line.split('\t')[0]);

    // 'B' < 'a', '-' < '.' < '_', and '.' < '/' by byte, which no locale would say.
    expect(listed).toEqual([
      'B.yaml',
      'a-b.yaml',
      'a.yaml',
      'a_b.yaml',
      'copy.yaml',
      'copy/en/x.yaml',
    ]);
  });

  it('does not depend on the order the documents were read in', () => {
    const forwards = new Map([
      ['identity.yaml', yaml('name: Ada\n')],
      ['brand.yaml', yaml('ink: "#111"\n')],
    ]);
    const backwards = new Map([...forwards].reverse());

    expect(digestOf(backwards)).toBe(digestOf(forwards));
  });
});

describe('the digest', () => {
  it('changes when any byte of any document changes', () => {
    const documents = new Map([['identity.yaml', yaml('name: Ada\n')]]);
    const original = digestOf(documents);

    documents.set('identity.yaml', yaml('name: Ada \n'));

    expect(digestOf(documents)).not.toBe(original);
  });

  it('changes when a document is renamed, added or removed', () => {
    const documents = new Map([['identity.yaml', yaml('name: Ada\n')]]);
    const original = digestOf(documents);

    const renamed = new Map([['identity2.yaml', yaml('name: Ada\n')]]);
    const added = new Map([...documents, ['brand.yaml', yaml('ink: "#111"\n')]]);

    expect(digestOf(renamed)).not.toBe(original);
    expect(digestOf(added)).not.toBe(original);
    expect(digestOf(new Map())).not.toBe(original);
  });

  it('changes when a document keeps its bytes and changes its media type', () => {
    const bytes = new TextEncoder().encode('# a note\n');

    expect(digestOf(new Map([['a.md', { mediaType: 'text/markdown', bytes }]]))).not.toBe(
      digestOf(new Map([['a.md', { mediaType: 'application/yaml', bytes }]])),
    );
  });
});
