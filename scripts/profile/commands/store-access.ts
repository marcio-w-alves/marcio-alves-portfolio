import { resolve } from 'node:path';
import { workTreeContaining } from '../home';
import { ReportedError } from '../reported-error';
import { targetOf } from '../store/connect';
import { profileStore, type ProfileStore } from '../store/profile-store';
import { ownerCredential, readCredential, type Credential, type Env } from '../store/urls';

/** How each store command reaches the database, and where it may write. */

export function ownerStore(env: Env, command: string): ProfileStore {
  return storeFor(ownerCredential(env), command);
}

export function readableStore(env: Env, command: string): ProfileStore {
  return storeFor(readCredential(env), command);
}

function storeFor({ url, variable }: Credential, command: string): ProfileStore {
  return profileStore({ url, variable, command });
}

/** The host a credential points at — the only part of a URL any output names. */
export function hostOf({ url, variable }: Credential): string {
  return targetOf(url, variable).host;
}

export class TargetInRepositoryError extends ReportedError {
  constructor(dir: string, workTree: string) {
    super(
      `Refusing to write the profile to ${dir}: it is inside the git work tree ${workTree}. A ` +
        'profile holds personal data and is kept outside the repository, where it cannot be ' +
        'committed by accident.',
    );
  }
}

/** The absolute path of a write target, once it is known to be outside the repository. */
export function writableTarget(dir: string): string {
  const target = resolve(dir);
  const workTree = workTreeContaining(target);
  if (workTree !== undefined) throw new TargetInRepositoryError(target, workTree);
  return target;
}
