/**
 * The profile's commands.
 *
 *   pnpm profile check <bundle dir>
 *       Reads a profile bundle and runs every check on it; writes nothing.
 *   pnpm profile materialize --out <dir> [--example] [--if-absent]
 *       Selects the profile (PROFILE_SOURCE, PROFILE_BUNDLE_DIR, VERCEL_ENV),
 *       checks it, and writes the files the site is built from under <dir>.
 *       --example takes the shipped example whatever the environment says;
 *       --if-absent does nothing when <dir> already holds a materialization.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { decodeBundle } from './profile/bundle/decode';
import { ProfileProblemsError } from './profile/bundle/problems';
import { checkProfile } from './profile/checks';
import { isMaterialized, materialize } from './profile/materialize';
import { selectSource, SelectionError, type Source } from './profile/select-source';
import { bundleDirectory } from './profile/workspace/bundle-directory';

const EXAMPLE_DIR = fileURLToPath(new URL('../profiles/example/', import.meta.url));

const USAGE =
  'Usage: pnpm profile check <bundle dir>\n' +
  '       pnpm profile materialize --out <dir> [--example] [--if-absent]';

class UsageError extends Error {}

async function check(dir: string | undefined) {
  if (!dir) throw new UsageError('check needs the bundle directory.');
  const { revision, profile } = await bundleDirectory(resolve(dir)).read();
  checkProfile(decodeBundle(profile.documents));
  console.log(
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
  // Materializing into the repository itself arrives with the site reading
  // these files; until then its generated files are committed and are not this
  // command's to overwrite.
  if (!values.out) throw new UsageError('materialize needs --out <dir>.');
  const out = resolve(values.out);
  if (values['if-absent'] && (await isMaterialized(out))) {
    console.log(`A profile is already materialized in ${out}; leaving it as it is.`);
    return;
  }
  const source: Source = values.example ? { kind: 'example' } : selectSource(process.env);
  await materialize({
    source,
    out,
    exampleDir: EXAMPLE_DIR,
    log: (line) => {
      console.log(line);
    },
  });
}

async function run([command, ...args]: readonly string[]) {
  switch (command) {
    case 'check':
      return check(args[0]);
    case 'materialize':
      return materializeCommand(args);
    default:
      throw new UsageError(command ? `Unknown command "${command}".` : 'Name a command.');
  }
}

try {
  await run(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n${USAGE}`);
  } else if (error instanceof ProfileProblemsError || error instanceof SelectionError) {
    console.error(error.message);
  } else {
    throw error;
  }
  process.exitCode = 1;
}
