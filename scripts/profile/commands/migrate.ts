import { withSession } from '../store/connect';
import { applyMigrations } from '../store/migrate';
import { ownerCredential, type Env } from '../store/urls';

/** `pnpm profile migrate` — brings the schema up to date, and says what it changed. */
export async function migrateCommand(env: Env, log: (line: string) => void): Promise<void> {
  const { url, variable } = ownerCredential(env);
  const applied = await withSession(
    { url, variable, applicationName: 'profile-migrate' },
    'Applying the migrations',
    applyMigrations,
  );
  log(
    applied.length === 0
      ? 'The schema is already up to date.'
      : `Applied ${applied.map(({ version, name }) => `${String(version)} (${name})`).join(', ')}.`,
  );
}
