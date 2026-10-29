/**
 * Which profile a build is made from — one rule, so production can never
 * silently ship the example:
 *
 * 1. `PROFILE_SOURCE` set: that source (`example` is the explicit opt-in a
 *    fork deploying the example on purpose sets).
 * 2. Otherwise the database when its URL is set, a bundle directory when one
 *    is named, and the example anywhere but a production deployment.
 * 3. A production deployment with none of these fails, naming the settings.
 *
 * An empty variable counts as unset: that is how a deployment clears one.
 */

export type Source =
  | { readonly kind: 'database'; readonly url: string }
  | { readonly kind: 'bundle'; readonly dir: string }
  | { readonly kind: 'example' };

export type Env = Readonly<Record<string, string | undefined>>;

export class SelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelectionError';
  }
}

export const PRODUCTION_NEEDS_A_PROFILE =
  'Production builds need a profile: set PROFILE_DATABASE_URL (read-only), or ' +
  'PROFILE_SOURCE=example to deploy the example on purpose.';

const SOURCES = ['database', 'bundle', 'example'] as const;

function setting(env: Env, name: string): string | undefined {
  const value = env[name];
  return value === undefined || value === '' ? undefined : value;
}

export function selectSource(env: Env): Source {
  const explicit = setting(env, 'PROFILE_SOURCE');
  const url = setting(env, 'PROFILE_DATABASE_URL');
  const dir = setting(env, 'PROFILE_BUNDLE_DIR');
  if (explicit !== undefined) return explicitSource(explicit, url, dir);
  if (url !== undefined && dir !== undefined) {
    throw new SelectionError(
      'Both PROFILE_DATABASE_URL and PROFILE_BUNDLE_DIR are set: unset one, or choose with ' +
        'PROFILE_SOURCE=database or PROFILE_SOURCE=bundle.',
    );
  }
  if (url !== undefined) return { kind: 'database', url };
  if (dir !== undefined) return { kind: 'bundle', dir };
  if (setting(env, 'VERCEL_ENV') !== 'production') return { kind: 'example' };
  throw new SelectionError(PRODUCTION_NEEDS_A_PROFILE);
}

function explicitSource(explicit: string, url?: string, dir?: string): Source {
  switch (explicit) {
    case 'database':
      if (url === undefined) {
        throw new SelectionError('PROFILE_SOURCE=database needs PROFILE_DATABASE_URL (read-only).');
      }
      return { kind: 'database', url };
    case 'bundle':
      if (dir === undefined) {
        throw new SelectionError(
          'PROFILE_SOURCE=bundle needs PROFILE_BUNDLE_DIR, the bundle directory.',
        );
      }
      return { kind: 'bundle', dir };
    case 'example':
      return { kind: 'example' };
    default:
      throw new SelectionError(
        `PROFILE_SOURCE is "${explicit}"; it must be one of ${SOURCES.join(', ')}.`,
      );
  }
}
