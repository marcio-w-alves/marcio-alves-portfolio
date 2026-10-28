import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = fileURLToPath(new URL('../app', import.meta.url));

// What Next.js gives a meaning to by its name: route segments, their
// boundaries, and the metadata files.
const SPECIAL_FILES = new Set([
  'page',
  'layout',
  'route',
  'template',
  'default',
  'loading',
  'error',
  'global-error',
  'not-found',
  'forbidden',
  'unauthorized',
  'icon',
  'apple-icon',
  'opengraph-image',
  'twitter-image',
  'sitemap',
  'robots',
  'manifest',
]);

const TOPIC_PAGES = ['experience', 'skills', 'projects', 'achievements', 'philosophy', 'education'];

function appFiles(): string[] {
  return readdirSync(app, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(app, join(entry.parentPath, entry.name)));
}

/** A file's name without its extension, or without `.test` and its extension for a test. */
function specialName(path: string): string {
  return basename(path).replace(/(\.test)?\.tsx?$/, '');
}

describe('the app folder', () => {
  it('holds only routes and Next.js special files, and their tests', () => {
    const files = appFiles();

    expect(files).toContain('layout.tsx');
    expect(files.filter((path) => !SPECIAL_FILES.has(specialName(path)))).toEqual([]);
  });

  it('gives the six topic pages one shape, differing only in the topic', () => {
    const shapes = TOPIC_PAGES.map((topic) =>
      readFileSync(join(app, topic, 'page.tsx'), 'utf8').replaceAll(`'${topic}'`, "'<topic>'"),
    );

    expect(shapes[0]).toContain("'<topic>'");
    expect(new Set(shapes).size).toBe(1);
  });
});
