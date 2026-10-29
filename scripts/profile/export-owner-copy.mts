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
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';
import { prepareLocaleCopy } from '../../src/core/assistant/copy/prepare';
import { SUPPORTED_LOCALES, type Locale } from '../../src/core/i18n/locale';
import { privateHomeDir, writePrivateFile } from './home';

// The bundle format's YAML: 1.2 core schema, no duplicate keys, no merge keys, few aliases.
const YAML_OPTIONS = {
  version: '1.2',
  schema: 'core',
  uniqueKeys: true,
  merge: false,
  strict: true,
  maxAliasCount: 100,
} as const;

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

const [source] = process.argv.slice(2);
if (!source) {
  throw new Error(
    'Give the directory the copy documents are kept in: ' +
      'pnpm exec tsx scripts/profile/export-owner-copy.mts <source-dir>',
  );
}

const from = resolve(source);
const locales = SUPPORTED_LOCALES.filter((locale) => existsSync(join(from, locale)));
if (locales.length === 0) {
  throw new Error(`No locale directory (${SUPPORTED_LOCALES.join(', ')}) under ${from}.`);
}

// Refuses a profile home inside any work tree of this repository.
const written = join(await privateHomeDir(process.env, 'bundles'), 'owner', 'copy');

let count = 0;
for (const locale of locales) {
  const documents = await readDocuments(join(from, locale));
  checkCompiles(documents, locale);
  for (const [path, text] of documents) {
    await writePrivateFile(join(written, locale, path), text);
    count += 1;
  }
}

console.log(`Wrote ${String(count)} copy documents for ${locales.join(', ')} → ${written}`);
