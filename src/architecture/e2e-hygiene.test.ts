import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * A browser test that waits on a clock passes on a fast machine and fails on a
 * slow one. End-to-end specs wait on conditions instead: web-first assertions,
 * `expect.poll`, or a recording taken in the page.
 */

const E2E_DIRECTORY = new URL('../../e2e/', import.meta.url);

interface Rule {
  readonly pattern: RegExp;
  readonly reason: string;
  readonly appliesTo: (file: string) => boolean;
}

const RULES: readonly Rule[] = [
  { pattern: /waitForTimeout/, reason: 'a fixed sleep', appliesTo: () => true },
  { pattern: /setTimeout\(/, reason: 'a timer', appliesTo: () => true },
  { pattern: /page\.waitFor\(\d/, reason: 'a fixed sleep', appliesTo: () => true },
  {
    pattern: /expect\(await /,
    reason: 'a single-shot reading of motion',
    appliesTo: (file) => file === 'motion.spec.ts',
  },
];

function clockWaits(file: string, source: string): string[] {
  return source
    .split('\n')
    .flatMap((line, index) =>
      RULES.filter((rule) => rule.appliesTo(file) && rule.pattern.test(line)).map(
        (rule) => `${file}:${String(index + 1)}: ${rule.reason}`,
      ),
    );
}

function e2eSources(): [file: string, source: string][] {
  return readdirSync(E2E_DIRECTORY, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => [file, readFileSync(new URL(file, E2E_DIRECTORY), 'utf8')]);
}

describe('end-to-end hygiene', () => {
  it('no e2e spec waits on a clock', () => {
    const sources = e2eSources();

    expect(sources.map(([file]) => file)).toContain('motion.spec.ts');
    expect(sources.flatMap(([file, source]) => clockWaits(file, source))).toEqual([]);
  });

  it.each([
    ['conversation.spec.ts', 'await page.waitForTimeout(500);', 'a fixed sleep'],
    ['support/assistant.ts', 'await new Promise((done) => setTimeout(done, 50));', 'a timer'],
    ['topics.spec.ts', 'await page.waitFor(1000);', 'a fixed sleep'],
    [
      'motion.spec.ts',
      'expect(await leftEdge(drawer)).toBeLessThan(0);',
      'a single-shot reading of motion',
    ],
  ])('reports a clock wait planted in %s', (file, line, reason) => {
    expect(clockWaits(file, `const ready = true;\n${line}\n`)).toEqual([`${file}:2: ${reason}`]);
  });

  it('allows a one-off read outside the motion spec', () => {
    expect(
      clockWaits('seo.spec.ts', 'expect(await response.text()).toContain("<title>");'),
    ).toEqual([]);
  });
});
