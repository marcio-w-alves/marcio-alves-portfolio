import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { profile } from '../../src/profile';
import { CALIBRATION } from '../../src/profile/evaluation/calibration';
import { RETRIEVAL_PROBES } from '../../src/profile/retrieval-probes';
import { profileHome } from './home';
import { checkBundle } from './testing/bundles';

/**
 * The bundle format has to carry a whole real profile, not only the example's
 * smaller one. This decodes the bundle written by
 * `pnpm exec tsx scripts/profile/export-repository-profile.mts` and holds it to
 * the profile the repository still assembles in TypeScript, part by part, so a
 * difference names the part it is in.
 *
 * That bundle holds personal data, so it lives under PROFILE_HOME, outside
 * every work tree, and is never committed. Where it has not been written —
 * CI, a fresh clone — these tests are skipped: the alternative would be
 * carrying the data into a public log.
 */

const dir = join(profileHome(process.env), 'bundles', 'owner');
const written = existsSync(dir);

describe.skipIf(!written)(
  'the profile this repository still holds as TypeScript, as a bundle',
  () => {
    it('passes every check', async () => {
      await expect(checkBundle(dir)).resolves.toBeDefined();
    });

    it('decodes to the same identity, brand, allow-list and evaluation', async () => {
      const { data } = await checkBundle(dir);
      const { sans, display, mono } = data.brand.fonts;

      expect(data.locales).toEqual(profile.locales);
      expect(data.identity).toEqual(profile.identity);
      expect({
        ...data.brand,
        fonts: {
          sans: { ...sans, face: undefined },
          display: { ...display, face: undefined },
          mono: { ...mono, face: undefined },
        },
      }).toEqual(profile.brand);
      expect(data.siteAllowList).toEqual(profile.siteAllowList);
      expect(data.evaluation.cases).toEqual(profile.evaluation);
      expect(data.evaluation.calibration).toEqual(CALIBRATION);
      expect(data.retrievalProbes).toEqual({ ...RETRIEVAL_PROBES });
    });

    it.each(Object.keys(profile.knowledge))(
      'decodes the record’s %s as the record holds it',
      async (part) => {
        const { data } = await checkBundle(dir);
        const key = part as keyof typeof profile.knowledge;

        expect(data.knowledge[key]).toEqual(profile.knowledge[key]);
      },
    );

    it('serves the files the record links to, from the bundle', async () => {
      const { data } = await checkBundle(dir);
      const served = data.assets.map(({ path }) => path);

      expect(served).toContain(profile.knowledge.profile.photoUrl);
      expect(served).toContain(profile.knowledge.contact.resumeUrl);
    });
  },
);
