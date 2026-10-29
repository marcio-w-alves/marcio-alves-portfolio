import { stat, symlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HomeInsideRepositoryError,
  privateHomeDir,
  profileHome,
  workTreeContaining,
  writePrivateFile,
} from './home';
import { REPOSITORY, scratchDir, type Scratch } from './testing/bundles';

/**
 * The owner's profile data lives in a home outside the repository, readable by
 * the owner alone, and no setting can point that home into a work tree.
 */

let scratch: Scratch;

beforeEach(async () => {
  scratch = await scratchDir();
});
afterEach(async () => {
  await scratch.remove();
});

const permissions = async (path: string) => (await stat(path)).mode & 0o777;

describe('the profile home', () => {
  it('defaults to the XDG data directory, outside the work tree', () => {
    const home = profileHome({});

    expect(home).toBe(join(homedir(), '.local', 'share', 'portfolio-profile'));
    expect(workTreeContaining(home)).toBeUndefined();
  });

  it('follows XDG_DATA_HOME, and treats an empty one as unset', () => {
    expect(profileHome({ XDG_DATA_HOME: '/data' })).toBe('/data/portfolio-profile');
    expect(profileHome({ XDG_DATA_HOME: '' })).toBe(profileHome({}));
  });

  it('refuses a PROFILE_HOME inside the repository', async () => {
    const inside = join(REPOSITORY, 'profiles', 'home-by-mistake');

    await expect(privateHomeDir({ PROFILE_HOME: inside }, 'bundles')).rejects.toBeInstanceOf(
      HomeInsideRepositoryError,
    );
    await expect(stat(inside)).rejects.toThrow();
  });

  it('refuses a PROFILE_HOME that reaches the repository through a symlink', async () => {
    const link = join(scratch.path, 'looks-outside');
    await symlink(join(REPOSITORY, 'profiles'), link);

    await expect(
      privateHomeDir({ PROFILE_HOME: join(link, 'home-by-mistake') }, 'bundles'),
    ).rejects.toThrow(/inside the git work tree/);
    await expect(stat(join(REPOSITORY, 'profiles', 'home-by-mistake'))).rejects.toThrow();
  });

  it('creates its directories for the owner alone, and their files too', async () => {
    const dir = await privateHomeDir({ PROFILE_HOME: join(scratch.path, 'home') }, 'backups');
    const file = join(dir, 'rev1', 'bundle.yaml');
    await writePrivateFile(file, 'format: 1\n');

    expect(dir).toBe(join(scratch.path, 'home', 'backups'));
    expect(await permissions(dir)).toBe(0o700);
    expect(await permissions(join(dir, 'rev1'))).toBe(0o700);
    expect(await permissions(file)).toBe(0o600);
  });
});
