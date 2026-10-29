/**
 * The profile's commands.
 *
 *   pnpm profile check <bundle dir>
 *       Reads a profile bundle and runs every check on it; writes nothing.
 *   pnpm profile materialize [--out <dir>] [--example] [--if-absent]
 *       Selects the profile (PROFILE_SOURCE, PROFILE_DATABASE_URL,
 *       PROFILE_BUNDLE_DIR), checks it, and writes the files the site is
 *       built from under <dir>. With no source set the site is built from the
 *       TypeScript profile and this writes nothing. --example takes the
 *       shipped example whatever the environment says; --if-absent does
 *       nothing when <dir> already holds a materialization.
 *   pnpm profile init
 *       Creates the roles, the schema and the migrations in an empty database
 *       (PROFILE_ADMIN_DATABASE_URL, used once).
 *   pnpm profile migrate
 *       Applies the pending migrations (PROFILE_OWNER_DATABASE_URL).
 *   pnpm profile export [dir]
 *       Writes the stored profile out as a bundle, outside the repository.
 *   pnpm profile diff <bundle dir>
 *       Says what importing that bundle would change, and writes nothing.
 *   pnpm profile import <bundle dir> [--note <text>]
 *       Checks the bundle, backs up the stored profile, and replaces it.
 *   pnpm profile revisions
 *       Lists the revisions the database keeps, head first.
 *   pnpm profile restore <revision>
 *       Makes an earlier revision the profile again, as a new revision.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { decodeBundle } from './profile/bundle/decode';
import { ProfileProblemsError } from './profile/bundle/problems';
import { checkProfile } from './profile/checks';
import { diffCommand } from './profile/commands/diff';
import { exportCommand } from './profile/commands/export';
import { importCommand } from './profile/commands/import';
import { initCommand } from './profile/commands/init';
import { migrateCommand } from './profile/commands/migrate';
import { restoreCommand } from './profile/commands/restore';
import { revisionsCommand } from './profile/commands/revisions';
import { HomeInsideRepositoryError, WorkTreesUnknownError } from './profile/home';
import { isMaterialized, materialize } from './profile/materialize';
import { ReportedError } from './profile/reported-error';
import { selectSource, SelectionError, type Source } from './profile/select-source';
import { bundleDirectory } from './profile/workspace/bundle-directory';

const EXAMPLE_DIR = fileURLToPath(new URL('../profiles/example/', import.meta.url));

const USAGE = [
  'Usage: pnpm profile check <bundle dir>',
  '       pnpm profile materialize [--out <dir>] [--example] [--if-absent]',
  '       pnpm profile init | migrate | revisions',
  '       pnpm profile export [dir]',
  '       pnpm profile diff <bundle dir>',
  '       pnpm profile import <bundle dir> [--note <text>]',
  '       pnpm profile restore <revision>',
].join('\n');

class UsageError extends Error {}

const log = (line: string) => {
  console.log(line);
};

async function check(dir: string | undefined) {
  if (!dir) throw new UsageError('check needs the bundle directory.');
  const { revision, profile } = await bundleDirectory(resolve(dir)).read();
  checkProfile(decodeBundle(profile.documents));
  log(
    `The profile in ${dir} passes every check (${String(profile.documents.size)} documents, ` +
      `digest ${revision.digest.slice(0, 12)}).`,
  );
}

async function materializeCommand(args: readonly string[]) {
  const { values } = parseArgs({
    args: [...args],
    options: {
      out: { type: 'string' },
      example: { type: 'boolean', default: false },
      'if-absent': { type: 'boolean', default: false },
    },
  });
  const source: Source = values.example ? { kind: 'example' } : selectSource(process.env);
  if (source.kind === 'typescript') {
    log(
      'No profile source is set, so the site is built from the TypeScript profile in ' +
        'src/profile: there is nothing to materialize.',
    );
    return;
  }
  // Materializing into the repository itself arrives with the site reading
  // these files; until then its generated files are committed and are not this
  // command's to overwrite. `pnpm build` passes no --out, so this is also what
  // stops a production deployment from being told to build from a profile the
  // site would not read: D4b may only drop it in the same change that puts the
  // production rule back into selectSource and assertProfileFitsDeployment.
  if (!values.out) {
    throw new UsageError(
      'src/profile is still what the site is built from, and a materialization cannot replace ' +
        'it yet: unset PROFILE_BUNDLE_DIR and PROFILE_DATABASE_URL, or name --out <dir> to ' +
        'materialize somewhere else.',
    );
  }
  const out = resolve(values.out);
  if (values['if-absent'] && (await isMaterialized(out))) {
    log(`A profile is already materialized in ${out}; leaving it as it is.`);
    return;
  }
  await materialize({ source, out, exampleDir: EXAMPLE_DIR, log });
}

function requiredArgument(value: string | undefined, what: string): string {
  if (!value) throw new UsageError(what);
  return value;
}

async function importBundle(args: readonly string[]) {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { note: { type: 'string' } },
    allowPositionals: true,
  });
  const dir = requiredArgument(positionals[0], 'import needs the bundle directory.');
  await importCommand(dir, values.note, process.env, log);
}

async function run([command, ...args]: readonly string[]) {
  switch (command) {
    case 'check':
      return check(args[0]);
    case 'materialize':
      return materializeCommand(args);
    case 'init':
      return initCommand(process.env, log);
    case 'migrate':
      return migrateCommand(process.env, log);
    case 'export':
      return exportCommand(args[0], process.env, log);
    case 'diff':
      return diffCommand(
        requiredArgument(args[0], 'diff needs the bundle directory.'),
        process.env,
        log,
      );
    case 'import':
      return importBundle(args);
    case 'revisions':
      return revisionsCommand(process.env, log);
    case 'restore':
      return restoreCommand(
        requiredArgument(args[0], 'restore needs the revision to restore.'),
        process.env,
        log,
      );
    default:
      throw new UsageError(command ? `Unknown command "${command}".` : 'Name a command.');
  }
}

/** Failures the owner is meant to read, said in one message and nothing more. */
const REPORTED = [
  ReportedError,
  ProfileProblemsError,
  SelectionError,
  HomeInsideRepositoryError,
  WorkTreesUnknownError,
];

try {
  await run(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n${USAGE}`);
  } else if (REPORTED.some((kind) => error instanceof kind)) {
    console.error((error as Error).message);
  } else {
    throw error;
  }
  process.exitCode = 1;
}
