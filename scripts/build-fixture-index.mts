/**
 * Writes the fictional fixture's retrieval index, which `pnpm test:fork` uses
 * in place of the owner's. Its vectors are seeded, not embedded, so no key is
 * needed. A test fails while the committed file differs from what this writes.
 *
 *   pnpm fixture:index
 */
import { writeFile } from 'node:fs/promises';
import { buildFixtureIndex } from '../src/testing/fixture-profile/fixture-index';

const OUTPUT = new URL(
  '../src/testing/fixture-profile/generated/knowledge-index.json',
  import.meta.url,
);

await writeFile(OUTPUT, `${JSON.stringify(buildFixtureIndex())}\n`);
console.log(`Wrote the fixture's index → ${OUTPUT.pathname}`);
