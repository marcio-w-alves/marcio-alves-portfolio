import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const folder = new URL('.', import.meta.url);
const guide = readFileSync(new URL('README.md', folder), 'utf8');

describe('the profile guide', () => {
  it('names every file and folder of the profile a reuser may meet', () => {
    const entries = readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.name !== 'README.md' && !entry.name.endsWith('.test.ts'))
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(guide, entry).toContain(`\`${entry}`);
  });

  it('says which commands to run after editing', () => {
    expect(guide).toContain('pnpm rag:build');
    expect(guide).toContain('pnpm test');
  });
});
