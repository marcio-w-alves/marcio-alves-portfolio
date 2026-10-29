import { describe, expect, it } from 'vitest';
import { PRODUCTION_NEEDS_A_PROFILE, selectSource, type Env, type Source } from './select-source';

/**
 * One rule picks the profile a build is made from. The table is every
 * combination that matters; production without a profile is the row that
 * must never quietly become the example.
 */

const URL = 'postgres://reader@db.example/profile';
const DIR = '/profiles/mine';

const selected: readonly [string, Env, Source][] = [
  [
    'PROFILE_SOURCE=database with its URL',
    { PROFILE_SOURCE: 'database', PROFILE_DATABASE_URL: URL },
    { kind: 'database', url: URL },
  ],
  [
    'PROFILE_SOURCE=bundle with its directory',
    { PROFILE_SOURCE: 'bundle', PROFILE_BUNDLE_DIR: DIR },
    { kind: 'bundle', dir: DIR },
  ],
  [
    'PROFILE_SOURCE=example in production (the opt-in)',
    { PROFILE_SOURCE: 'example', VERCEL_ENV: 'production' },
    { kind: 'example' },
  ],
  [
    'PROFILE_SOURCE=example over a URL and a directory',
    { PROFILE_SOURCE: 'example', PROFILE_DATABASE_URL: URL, PROFILE_BUNDLE_DIR: DIR },
    { kind: 'example' },
  ],
  [
    'PROFILE_SOURCE=bundle beside a URL',
    { PROFILE_SOURCE: 'bundle', PROFILE_DATABASE_URL: URL, PROFILE_BUNDLE_DIR: DIR },
    { kind: 'bundle', dir: DIR },
  ],
  [
    'only the URL, in production',
    { PROFILE_DATABASE_URL: URL, VERCEL_ENV: 'production' },
    { kind: 'database', url: URL },
  ],
  [
    'only the directory, in production',
    { PROFILE_BUNDLE_DIR: DIR, VERCEL_ENV: 'production' },
    { kind: 'bundle', dir: DIR },
  ],
  ['nothing, without VERCEL_ENV', {}, { kind: 'example' }],
  ['nothing, in a preview', { VERCEL_ENV: 'preview' }, { kind: 'example' }],
  ['nothing, in development', { VERCEL_ENV: 'development' }, { kind: 'example' }],
  [
    'empty values, which count as unset',
    { PROFILE_SOURCE: '', PROFILE_DATABASE_URL: '', PROFILE_BUNDLE_DIR: '' },
    { kind: 'example' },
  ],
];

const refused: readonly [string, Env, string][] = [
  ['nothing, in production', { VERCEL_ENV: 'production' }, PRODUCTION_NEEDS_A_PROFILE],
  [
    'empty values, in production',
    { VERCEL_ENV: 'production', PROFILE_DATABASE_URL: '', PROFILE_SOURCE: '' },
    PRODUCTION_NEEDS_A_PROFILE,
  ],
  [
    'PROFILE_SOURCE=database without its URL',
    { PROFILE_SOURCE: 'database' },
    'PROFILE_SOURCE=database needs PROFILE_DATABASE_URL (read-only).',
  ],
  [
    'PROFILE_SOURCE=bundle without its directory',
    { PROFILE_SOURCE: 'bundle', PROFILE_BUNDLE_DIR: '' },
    'PROFILE_SOURCE=bundle needs PROFILE_BUNDLE_DIR, the bundle directory.',
  ],
  [
    'an unknown PROFILE_SOURCE',
    { PROFILE_SOURCE: 'owner' },
    'PROFILE_SOURCE is "owner"; it must be one of database, bundle, example.',
  ],
  [
    'both the URL and the directory',
    { PROFILE_DATABASE_URL: URL, PROFILE_BUNDLE_DIR: DIR },
    'Both PROFILE_DATABASE_URL and PROFILE_BUNDLE_DIR are set: unset one, or choose with PROFILE_SOURCE=database or PROFILE_SOURCE=bundle.',
  ],
];

describe('which profile a build is made from', () => {
  it.each(selected)('%s', (_case, env, source) => {
    expect(selectSource(env)).toEqual(source);
  });

  it.each(refused)('refuses %s, naming the setting', (_case, env, message) => {
    expect(() => selectSource(env)).toThrow(message);
  });

  it('tells a production build without a profile both ways to give it one', () => {
    expect(PRODUCTION_NEEDS_A_PROFILE).toContain('PROFILE_DATABASE_URL');
    expect(PRODUCTION_NEEDS_A_PROFILE).toContain('PROFILE_SOURCE=example');
  });
});
