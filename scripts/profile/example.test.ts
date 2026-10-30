import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fixtureBrand,
  fixtureCalibration,
  fixtureIdentity,
  fixtureKnowledge,
  fixtureSiteAllowList,
  profile as fixtureProfile,
} from '../../src/testing/fixture-profile';
import {
  checkBundle,
  CLI_TEST_TIMEOUT_MS,
  EXAMPLE_DIR,
  exampleCopy,
  runExampleBuilder,
  scratchDir,
} from './testing/bundles';

/**
 * The shipped example is the fictional fixture the tests have always used,
 * now as a bundle: decoding it gives back exactly the fixture's TypeScript
 * modules (until those are replaced by it), and its generated files are what
 * the keyless builders write.
 */

const example = await checkBundle(EXAMPLE_DIR);

/** The documents the keyless builder writes, which no one edits by hand. */
const GENERATED = [
  'generated/notes.json',
  'generated/knowledge-index.json',
  'generated/retrieval-probes.json',
];

describe('the example bundle', () => {
  it('decodes to the fixture record, identity, brand, allow-list, cases and calibration', () => {
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
    expect(data.evaluation.calibration).toEqual(fixtureCalibration);
  });

  it('sets each font role in one of the faces the template bundles', () => {
    const faces = Object.values(example.data.brand.fonts).map(({ face }) => face);
    expect(faces).toEqual(['inter', 'inter-tight', 'geist-mono']);
  });

  it('is published in English and Portuguese, every text of its record written in both', () => {
    expect(example.data.locales).toEqual(['en', 'pt-BR']);
  });

  it(
    'commits the notes, index and probe embeddings the keyless builder writes, byte for byte',
    { timeout: CLI_TEST_TIMEOUT_MS },
    async () => {
      const scratch = await scratchDir();
      try {
        const dir = await exampleCopy(scratch);
        // Overwritten first, so a builder that wrote nothing could not pass.
        for (const path of GENERATED) {
          await writeFile(join(dir, path), '{"written":"by this test"}\n');
        }

        const run = await runExampleBuilder(dir);

        expect(run.code).toBe(0);
        for (const path of GENERATED) {
          expect(await readFile(join(dir, path)), path).toEqual(
            await readFile(join(EXAMPLE_DIR, path)),
          );
        }
      } finally {
        await scratch.remove();
      }
    },
  );
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
