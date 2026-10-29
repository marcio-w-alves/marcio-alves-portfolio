import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { CopyDocuments } from '@/core/assistant/copy/copy-document';
import type { Locale } from '@/core/i18n/locale';

/**
 * Copy documents decoded with the bundle format's YAML settings, for the tests
 * that compile them before the build materializes a profile.
 *
 * The example's are in the repository: a fictional person, which is the point
 * of shipping them. The owner's are personal data and so live in his private
 * profile home, outside every work tree, written there by
 * `pnpm exec tsx scripts/profile/export-owner-copy.mts`. Where they have not
 * been written — CI, a fresh clone — the tests that read them are skipped;
 * carrying that prose into a public log is the thing being avoided.
 */

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

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
 * The same rule as `scripts/profile/home.ts`, which shipped code may not
 * import (`src-never-imports-scripts`); only the tooling checks that the
 * directory really is outside the repository, because only the tooling writes.
 */
function profileHome(env: Readonly<Record<string, string | undefined>> = process.env): string {
  if (env.PROFILE_HOME) return resolve(env.PROFILE_HOME);
  const dataHome = env.XDG_DATA_HOME ?? '';
  return join(dataHome === '' ? join(homedir(), '.local', 'share') : dataHome, 'portfolio-profile');
}

/** Where the owner's copy documents are, once he has exported them. */
export function ownerCopyDirectory(locale: Locale): string {
  return join(profileHome(), 'bundles', 'owner', 'copy', locale);
}

export function exampleCopyDirectory(locale: Locale): string {
  return join(repositoryRoot, 'profiles', 'example', 'copy', locale);
}

/** Whether the owner has exported his copy to his profile home. */
export function ownerCopyWritten(locales: readonly Locale[]): boolean {
  return locales.every((locale) => existsSync(ownerCopyDirectory(locale)));
}

function yamlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return yamlFiles(path);
    return entry.name.endsWith('.yaml') ? [path] : [];
  });
}

export function readCopyDocuments(directory: string): CopyDocuments {
  return Object.fromEntries(
    yamlFiles(directory).map((path) => [
      relative(directory, path).split('\\').join('/'),
      parse(readFileSync(path, 'utf8'), YAML_OPTIONS) as unknown,
    ]),
  );
}

export function exampleCopy(locale: Locale): CopyDocuments {
  return readCopyDocuments(exampleCopyDirectory(locale));
}

export function ownerCopy(locale: Locale): CopyDocuments {
  return readCopyDocuments(ownerCopyDirectory(locale));
}
