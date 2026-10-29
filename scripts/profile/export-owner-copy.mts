/**
 * Moves the owner's copy documents — his answers, topic pages, vocabulary,
 * card labels, interface overrides and about page, written as templates — into
 * his private profile home, beside the rest of his bundle.
 *
 * Unlike the record, copy is not a serialization of anything the repository
 * holds: the templates are written by hand, so there is nothing to generate
 * them from. This command therefore takes the directory they are kept in,
 * checks every document compiles, and writes them where the bundle lives:
 *
 *   pnpm exec tsx scripts/profile/export-owner-copy.mts <source-dir>
 *
 * `<source-dir>` holds one directory per published locale (`en/`, `pt-BR/`).
 * They are never written inside a work tree of this repository: the prose is
 * personal data, and the guarantee has to be that the tools cannot commit it,
 * not that `.gitignore` would have hidden it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { prepareLocaleCopy } from '../../src/core/assistant/copy/prepare';
import { SUPPORTED_LOCALES, type Locale } from '../../src/core/i18n/locale';
import { gitEnvironment } from '../baseline/git-environment';

const PRIVATE_DIR = 0o700;
const PRIVATE_FILE = 0o600;
const GIT_TIMEOUT_MS = 10_000;
const TOOL_DIR = dirname(fileURLToPath(import.meta.url));

// The bundle format's YAML: 1.2 core schema, no duplicate keys, no merge keys, few aliases.
const YAML_OPTIONS = {
  version: '1.2',
  schema: 'core',
  uniqueKeys: true,
  merge: false,
  strict: true,
  maxAliasCount: 100,
} as const;

/**
 * `PROFILE_HOME`, else `${XDG_DATA_HOME:-~/.local/share}/portfolio-profile`.
 *
 * TODO(POR-90 merge): delete this and the work-tree check below, and call
 * `privateHomeDir(process.env, 'bundles')` from `./home.ts`, which POR-90
 * adds with the same rule and the same refusal.
 */
function profileHome(env: NodeJS.ProcessEnv): string {
  if (env.PROFILE_HOME) return resolve(env.PROFILE_HOME);
  const dataHome = env.XDG_DATA_HOME ?? '';
  return join(dataHome === '' ? join(homedir(), '.local', 'share') : dataHome, 'portfolio-profile');
}

/** The real path of the deepest existing ancestor, with the rest appended. */
function resolveThroughSymlinks(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    const parent = dirname(path);
    if (parent === path) return path;
    return join(resolveThroughSymlinks(parent), basename(path));
  }
}

/** Every work tree of this repository: its main checkout and each linked one. */
function workTrees(): string[] {
  const listing = execFileSync('git', ['-C', TOOL_DIR, 'worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    env: gitEnvironment(),
  });
  return listing
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => resolveThroughSymlinks(line.slice('worktree '.length)));
}

function refuseInsideRepository(target: string): void {
  const resolved = resolveThroughSymlinks(target);
  const inside = workTrees().find(
    (workTree) => resolved === workTree || resolved.startsWith(workTree + sep),
  );
  if (inside) {
    throw new Error(
      `Refusing to write ${target}: it is inside the git work tree ${inside}, and the owner's ` +
        'copy is kept outside the repository. Set PROFILE_HOME to a directory elsewhere.',
    );
  }
}

async function yamlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return yamlFiles(path);
      return entry.name.endsWith('.yaml') ? [path] : [];
    }),
  );
  return found.flat();
}

async function readDocuments(directory: string): Promise<Map<string, string>> {
  const files = await yamlFiles(directory);
  const documents = new Map<string, string>();
  for (const path of files) {
    documents.set(relative(directory, path).split(sep).join('/'), await readFile(path, 'utf8'));
  }
  return documents;
}

/** Parses every document and compiles the locale, so nothing invalid is written. */
function checkCompiles(documents: ReadonlyMap<string, string>, locale: Locale): void {
  const parsed = Object.fromEntries(
    [...documents].map(([path, text]) => [path, parse(text, YAML_OPTIONS) as unknown]),
  );
  prepareLocaleCopy(parsed, locale);
}

async function writePrivate(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: PRIVATE_DIR });
  await writeFile(path, text, { mode: PRIVATE_FILE });
}

const [source] = process.argv.slice(2);
if (!source) {
  throw new Error(
    'Give the directory the copy documents are kept in: ' +
      'pnpm exec tsx scripts/profile/export-owner-copy.mts <source-dir>',
  );
}

const from = resolve(source);
const written = join(profileHome(process.env), 'bundles', 'owner', 'copy');
refuseInsideRepository(written);

const locales = SUPPORTED_LOCALES.filter((locale) => existsSync(join(from, locale)));
if (locales.length === 0) {
  throw new Error(`No locale directory (${SUPPORTED_LOCALES.join(', ')}) under ${from}.`);
}

let count = 0;
for (const locale of locales) {
  const documents = await readDocuments(join(from, locale));
  checkCompiles(documents, locale);
  for (const [path, text] of documents) {
    await writePrivate(join(written, locale, path), text);
    count += 1;
  }
}

console.log(`Wrote ${String(count)} copy documents for ${locales.join(', ')} → ${written}`);
