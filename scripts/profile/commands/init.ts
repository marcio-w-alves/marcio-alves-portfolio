import { initialiseStore } from '../store/initialise';
import { adminCredential, type Env } from '../store/urls';

/** `pnpm profile init` — the roles, the schema and the migrations, from an empty database. */
export async function initCommand(env: Env, log: (line: string) => void): Promise<void> {
  await initialiseStore(adminCredential(env), env, log);
}
