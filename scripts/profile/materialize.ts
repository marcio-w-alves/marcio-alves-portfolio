import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { renderBrandCss } from '../../src/site/brand-css';
import { decodeBundle, documentAt } from './bundle/decode';
import { DOCUMENTS } from './bundle/layout';
import { checkProfile } from './checks';
import { type Source } from './select-source';
import { bundleDirectory } from './workspace/bundle-directory';
import { databaseWorkspace } from './workspace/database';
import type { ProfileWorkspace } from './workspace/workspace';

/**
 * Writes the selected profile as the files the site is built from — the
 * profile's data, its retrieval index and probes, its brand stylesheet, what
 * the global error page may know, a manifest of where it all came from, and
 * its assets under `public/` — after every check has passed. A profile that
 * fails a check writes nothing, and a run that stops midway leaves the
 * previous files whole.
 */

/**
 * A profile the build can materialize. The TypeScript profile is not one: its
 * generated files are written by hand and committed, and until the site is
 * built from a materialization instead they are not this command's to
 * overwrite.
 */
export type MaterializedSource = Exclude<Source, { readonly kind: 'typescript' }>;

export interface MaterializeOptions {
  readonly source: MaterializedSource;
  /** The directory the files are written under, as the repository root lays them out. */
  readonly out: string;
  /** The shipped example bundle, `profiles/example`. */
  readonly exampleDir: string;
  readonly log: (line: string) => void;
}

export interface Manifest {
  readonly source: MaterializedSource['kind'];
  readonly revision: string;
  readonly digest: string;
  readonly format: number;
  readonly locales: readonly string[];
  readonly materializedAt: string;
}

export const GENERATED_DIR = 'src/profile/generated';
const PUBLIC_DIR = 'public';
/** The public files the previous run wrote, so the next removes only its own. */
const PUBLIC_LEDGER = '.materialized.json';

export function manifestPath(out: string): string {
  return join(out, GENERATED_DIR, 'manifest.json');
}

export async function isMaterialized(out: string): Promise<boolean> {
  return access(manifestPath(out)).then(
    () => true,
    () => false,
  );
}

function workspaceFor(source: MaterializedSource, exampleDir: string): ProfileWorkspace {
  switch (source.kind) {
    case 'example':
      return bundleDirectory(exampleDir);
    case 'bundle':
      return bundleDirectory(source.dir);
    case 'database':
      return databaseWorkspace(source.url, 'materialize');
  }
}

export async function materialize({
  source,
  out,
  exampleDir,
  log,
}: MaterializeOptions): Promise<Manifest> {
  const started = performance.now();
  const { revision, profile } = await workspaceFor(source, exampleDir).read();
  const decoded = decodeBundle(profile.documents);
  const { data } = checkProfile(decoded);
  const manifest: Manifest = {
    source: source.kind,
    revision: revision.id,
    digest: revision.digest,
    format: profile.format,
    locales: data.locales,
    materializedAt: new Date().toISOString(),
  };
  const bytesOf = (path: string) => documentAt(profile.documents, path).bytes;
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const generated = await stageDirectory(join(out, GENERATED_DIR), {
    'profile.json': json(data),
    'knowledge-index.json': bytesOf(DOCUMENTS.index),
    'retrieval-probes.json': bytesOf(DOCUMENTS.probeEmbeddings),
    'brand.css': renderBrandCss(data.brand),
    'global-error.json': json({ name: data.identity.name }),
    'manifest.json': json(manifest),
  });
  const assets = await stagePublicFiles(
    join(out, PUBLIC_DIR),
    new Map(data.assets.map(({ file, path }) => [path, bytesOf(file)])),
  );
  // Both sides are written in full before either is swapped in, so a failure
  // while reading or checking can never leave the site half one profile.
  await generated.swapIn();
  await assets.swapIn();
  log(
    `Materialized the ${source.kind} profile: revision ${revision.id}, digest ` +
      `${revision.digest.slice(0, 12)}, ${String(profile.documents.size)} documents, ` +
      `${String(Math.round(performance.now() - started))} ms.`,
  );
  return manifest;
}

export interface Staged {
  /** Puts the staged files in place, and removes what they replace. */
  readonly swapIn: () => Promise<void>;
}

/** Writes a whole directory beside the target, ready to be swapped in with two renames. */
export async function stageDirectory(
  target: string,
  files: Readonly<Record<string, string | Uint8Array>>,
): Promise<Staged> {
  const staging = join(dirname(target), `.materialize-${randomUUID()}`);
  const previous = `${staging}-previous`;
  await mkdir(staging, { recursive: true });
  try {
    for (const [name, content] of Object.entries(files))
      await writeFile(join(staging, name), content);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return {
    swapIn: async () => {
      try {
        const hadPrevious = await rename(target, previous).then(
          () => true,
          (error: unknown) => {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
            throw error;
          },
        );
        await rename(staging, target);
        if (hadPrevious) await rm(previous, { recursive: true });
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    },
  };
}

// Only names at the root of public/, so an edited ledger cannot remove anything else.
const LEDGER_ENTRY = /^\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

async function readLedger(dir: string): Promise<string[]> {
  try {
    const listed = JSON.parse(await readFile(join(dir, PUBLIC_LEDGER), 'utf8')) as unknown;
    return Array.isArray(listed)
      ? listed.filter((path): path is string => typeof path === 'string' && LEDGER_ENTRY.test(path))
      : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Writes each asset beside its address; swapping in renames them into place,
 * removes the ones the previous run wrote that this profile lacks, and leaves
 * everything else in `public/` alone.
 */
export async function stagePublicFiles(
  dir: string,
  assets: ReadonlyMap<string, Uint8Array>,
): Promise<Staged> {
  await mkdir(dir, { recursive: true });
  const staged = new Map<string, string>();
  try {
    for (const [path, bytes] of assets) {
      const temporary = join(dir, `.${randomUUID()}.tmp`);
      await writeFile(temporary, bytes);
      staged.set(path, temporary);
    }
  } catch (error) {
    for (const temporary of staged.values()) await rm(temporary, { force: true });
    throw error;
  }
  const stale = (await readLedger(dir)).filter((path) => !assets.has(path));
  return {
    swapIn: async () => {
      for (const path of stale) await rm(join(dir, path), { force: true });
      for (const [path, temporary] of staged) await rename(temporary, join(dir, path));
      await writeFile(join(dir, PUBLIC_LEDGER), `${JSON.stringify([...assets.keys()])}\n`);
    },
  };
}
