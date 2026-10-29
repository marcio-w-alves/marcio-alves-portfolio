import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkBundle,
  exampleCopy,
  problemsOf,
  scratchDir,
  writeDocument,
  type Scratch,
} from '../testing/bundles';

/**
 * YAML is read strictly — no surprise booleans, duplicate keys, merge keys,
 * tags or alias bombs — and a bundle states the one format this code reads.
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

const writePrivacy = (yaml: string) => writeDocument(dir, 'privacy.yaml', yaml);

describe('the YAML of a bundle', () => {
  it('refuses a duplicate key, at its line and column', async () => {
    await writePrivacy('phone: ["+351 900 000 000"]\nphone: ["+351 900 000 001"]\n');

    expect(await problemsOf(dir)).toEqual([
      'privacy.yaml#2:1: Map keys must be unique — fix the YAML there',
    ]);
  });

  it('reads "yes" as the word, not a boolean', async () => {
    await writePrivacy('phrases: [yes, no, on]\n');

    expect((await checkBundle(dir)).privacy.phrases).toEqual(['yes', 'no', 'on']);
  });

  it('refuses a merge key', async () => {
    await writePrivacy('a: &base\n  phone: ["+351 900 000 000"]\nb:\n  <<: *base\n');

    expect(await problemsOf(dir)).toContain(
      'privacy.yaml#4:3: Merge keys (<<) are not supported; write the keys out — fix the YAML there',
    );
  });

  it('refuses a tag', async () => {
    await writePrivacy('phrases: [!!binary aGk=]\n');

    const [problem] = await problemsOf(dir);
    expect(problem).toMatch(/^privacy\.yaml#1:\d+: .*binary/);
  });

  const withAliases = (count: number) =>
    `phrases:\n  - &phrase a phrase\n${'  - *phrase\n'.repeat(count)}`;

  it('reads 100 aliases and refuses 101', async () => {
    await writePrivacy(withAliases(100));
    expect((await checkBundle(dir)).privacy.phrases).toHaveLength(101);

    await writePrivacy(withAliases(101));
    expect(await problemsOf(dir)).toEqual([
      'privacy.yaml: 101 aliases; at most 100 are read — fix the YAML there',
    ]);
  });

  it('refuses aliases that expand to more than they say', async () => {
    const levels = ['a: &a [x, x, x, x, x, x, x, x, x, x]'];
    for (const name of ['b', 'c', 'd', 'e']) {
      const previous = String.fromCharCode(name.charCodeAt(0) - 1);
      levels.push(`${name}: &${name} [${Array(10).fill(`*${previous}`).join(', ')}]`);
    }
    await writePrivacy(`${levels.join('\n')}\n`);

    expect(await problemsOf(dir)).toEqual([
      'privacy.yaml: Excessive alias count indicates a resource exhaustion attack — fix the YAML there',
    ]);
  });

  it('reports a syntax error at its line and column', async () => {
    await writePrivacy('phrases:\n  - one\n - two\n');

    const [problem] = await problemsOf(dir);
    expect(problem).toMatch(/^privacy\.yaml#3:\d+: .+ — fix the YAML there$/);
  });
});

describe('the format of a bundle', () => {
  it('refuses a bundle written in another format, saying which it reads', async () => {
    await writeDocument(dir, 'bundle.yaml', 'format: 2\nlocales: [en, pt-BR]\n');

    expect(await problemsOf(dir)).toEqual([
      'bundle.yaml#/format: this bundle is format 2; this template reads format 1 — use the template version the bundle was written for, or upgrade the bundle',
    ]);
  });

  it('refuses a directory without bundle.yaml', async () => {
    await rm(join(dir, 'bundle.yaml'));

    expect(await problemsOf(dir)).toEqual([
      'bundle.yaml: is missing — add it, with `format: 1` and the published locales',
    ]);
  });

  it('names every document a bundle is missing', async () => {
    await rm(join(dir, 'knowledge', 'metrics.yaml'));
    await rm(join(dir, 'retrieval', 'probes.yaml'));

    expect(await problemsOf(dir)).toEqual([
      'retrieval/probes.yaml: is missing — add it; see profiles/README.md',
      'knowledge/metrics.yaml: is missing — add it; see profiles/README.md',
    ]);
  });

  it('refuses copy for a language the profile does not publish', async () => {
    await writeDocument(dir, 'bundle.yaml', 'format: 1\nlocales: [en]\n');
    await writeDocument(dir, 'copy/pt-BR/ui.yaml', 'emailSubject: Vaga\n');

    expect(await problemsOf(dir)).toEqual([
      'copy/pt-BR/ui.yaml: pt-BR is not a published locale — add pt-BR to the locales of bundle.yaml, or remove its copy',
    ]);
  });

  it('refuses a part of the record in a document that does not hold it', async () => {
    await writeDocument(
      dir,
      'knowledge/references.yaml',
      'references:\n  technologies: {}\nmetrics: {}\n',
    );

    expect(await problemsOf(dir)).toEqual([
      'knowledge/references.yaml#/metrics: "metrics" does not belong in this document — it holds references',
    ]);
  });
});
