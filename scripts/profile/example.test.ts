import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fixtureBrand,
  fixtureIdentity,
  fixtureKnowledge,
  fixtureSiteAllowList,
  profile as fixtureProfile,
} from '../../src/testing/fixture-profile';
import { checkBundle, EXAMPLE_DIR } from './testing/bundles';
import { seededIndex, seededProbes } from './seeded-index';

/**
 * The shipped example is the fictional fixture the tests have always used,
 * now as a bundle: decoding it gives back exactly the fixture's TypeScript
 * modules (until those are replaced by it), and its generated files are what
 * the keyless builders write.
 */

const example = await checkBundle(EXAMPLE_DIR);

describe('the example bundle', () => {
  it('decodes to the fixture record, identity, brand, allow-list and evaluation', () => {
    const { data } = example;
    const { sans, display, mono } = data.brand.fonts;
    const withoutFaces = {
      ...data.brand,
      fonts: {
        sans: { ...sans, face: undefined },
        display: { ...display, face: undefined },
        mono: { ...mono, face: undefined },
      },
    };

    expect(data.knowledge).toEqual(fixtureKnowledge);
    expect(data.identity).toEqual(fixtureIdentity);
    expect(withoutFaces).toEqual(fixtureBrand);
    expect(data.siteAllowList).toEqual(fixtureSiteAllowList);
    expect(data.evaluation.cases).toEqual(fixtureProfile.evaluation);
  });

  it('sets each font role in one of the faces the template bundles', () => {
    const faces = Object.values(example.data.brand.fonts).map(({ face }) => face);
    expect(faces).toEqual(['inter', 'inter-tight', 'geist-mono']);
  });

  it('is published in English and Portuguese, every text of its record written in both', () => {
    expect(example.data.locales).toEqual(['en', 'pt-BR']);
  });

  it('commits the index and probe embeddings the seeded builder writes, byte for byte', async () => {
    const read = (path: string) => readFile(join(EXAMPLE_DIR, path), 'utf8');

    expect(await read('generated/knowledge-index.json')).toBe(seededIndex(example.data.knowledge));
    expect(await read('generated/retrieval-probes.json')).toBe(
      seededProbes(Object.values(example.data.retrievalProbes)),
    );
  });
});

/** Width and height from a JPEG's start-of-frame segment. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < bytes.length) {
    const marker = bytes.readUInt16BE(offset);
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('No start-of-frame segment.');
}

describe('the example assets', () => {
  const asset = (path: string) => readFile(join(EXAMPLE_DIR, 'assets', path));

  it('serves a 512 × 512 JPEG photo where the record links to it', async () => {
    const photo = example.data.assets.find(
      ({ path }) => path === example.data.knowledge.profile.photoUrl,
    );

    expect(photo?.mediaType).toBe('image/jpeg');
    expect(jpegSize(await asset('ada-rivera.jpg'))).toEqual({ width: 512, height: 512 });
  });

  it('serves a one-page PDF résumé where the record links to it', async () => {
    const resume = example.data.assets.find(
      ({ path }) => path === example.data.knowledge.contact.resumeUrl,
    );
    const pdf = (await asset('ada-rivera-cv.pdf')).toString('latin1');

    expect(resume?.mediaType).toBe('application/pdf');
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(1);
  });
});
