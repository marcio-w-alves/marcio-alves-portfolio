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

type Env = Readonly<Record<string, string | undefined>>;

/** Where the owner's copy documents are, once he has exported them. */
export function ownerCopyDirectory(locale: Locale, env: Env = process.env): string {
  return join(profileHome(env), 'bundles', 'owner', 'copy', locale);
}

export function exampleCopyDirectory(locale: Locale): string {
  return join(repositoryRoot, 'profiles', 'example', 'copy', locale);
}

/** Where a machine says the owner's copy must be there to be proven. */
export const OWNER_COPY_REQUIRED = 'OWNER_COPY=required';

const EXPORT_COMMAND = 'pnpm exec tsx scripts/profile/export-owner-copy.mts <source-dir>';

/**
 * Whether the owner's equivalence oracle can run, must not run, or must fail.
 *
 * The oracle is the proof that his copy data says what his TypeScript copy
 * says, and it needs his copy documents, which are not in the repository.
 * Skipping it is right where they were never written — CI, a fork, a fresh
 * clone — and says so out loud, because a silent skip reads like a proof.
 * It is wrong in two cases, which fail instead:
 *
 * - a partial export, where some languages are there and others are not: the
 *   data is on this machine, so there is no honest reason to prove none of it;
 * - `OWNER_COPY=required`, which the pre-push hook sets, so a push from the
 *   owner's machine always runs the real thing.
 */
export type OwnerCopyStatus =
  | { readonly kind: 'ready' }
  | { readonly kind: 'skipped'; readonly reason: string }
  | { readonly kind: 'failed'; readonly problem: string };

export function ownerCopyStatus(
  locales: readonly Locale[],
  env: Env = process.env,
): OwnerCopyStatus {
  const missing = locales.filter((locale) => !existsSync(ownerCopyDirectory(locale, env)));
  if (missing.length === 0) return { kind: 'ready' };
  const named = missing.map((locale) => ownerCopyDirectory(locale, env)).join(' and ');
  const are = missing.length === 1 ? 'is' : 'are';
  if (missing.length < locales.length) {
    return {
      kind: 'failed',
      problem:
        `The owner's copy is exported for ${String(locales.length - missing.length)} of ` +
        `${String(locales.length)} languages: ${named} ${are} missing, so the proof that his ` +
        `copy data says what his TypeScript copy says covered none of them. Export them all with ` +
        `\`${EXPORT_COMMAND}\`.`,
    };
  }
  if (env.OWNER_COPY === 'required') {
    return {
      kind: 'failed',
      problem:
        `${OWNER_COPY_REQUIRED} asks for the owner's copy, but ${named} ${are} not there, so the ` +
        `proof that his copy data says what his TypeScript copy says did not run. Write the ` +
        `documents with \`${EXPORT_COMMAND}\`, or unset OWNER_COPY to allow the skip.`,
    };
  }
  return {
    kind: 'skipped',
    reason:
      `The owner's copy is not in ${named}, so the proof that his copy data says what his ` +
      `TypeScript copy says did not run. That is expected away from his machine; set ` +
      `${OWNER_COPY_REQUIRED} to make it a failure instead.`,
  };
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

export function ownerCopy(locale: Locale, env: Env = process.env): CopyDocuments {
  return readCopyDocuments(ownerCopyDirectory(locale, env));
}
