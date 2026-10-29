import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * `pnpm test:fork` runs the suite as a fork would: the fictional fixture in
 * place of the owner's profile, and without the profile's own tests, which a
 * fork replaces along with the profile. Everything else must pass unedited.
 */
const asFork = process.env.PROFILE_UNDER_TEST === 'fixture';

/**
 * `pnpm test:store` runs the store suite against a real Postgres (see
 * `scripts/profile/store/testing/postgres.sh`). It is a project of its own, and
 * only that script defines it, so `pnpm test` never reaches for a database —
 * and when it does run, a missing database fails the run instead of skipping it.
 */
const storeTests = process.env.PROFILE_STORE_TESTS === '1';
const STORE_SUITE = 'scripts/**/*.store.test.ts';

const alias = [
  ...(asFork
    ? [
        { find: /^@\/profile$/, replacement: source('./src/testing/fixture-profile/index.ts') },
        {
          find: /^@\/profile\/generated\/knowledge-index\.json$/,
          replacement: source('./src/testing/fixture-profile/generated/knowledge-index.json'),
        },
      ]
    : []),
  { find: '@', replacement: source('./src') },
  { find: 'server-only', replacement: source('./src/testing/empty-module.ts') },
];

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    restoreMocks: true,
    // Boundary fixtures are source trees the architecture tests cruise, not suites to run.
    exclude: [
      ...configDefaults.exclude,
      'src/architecture/fixtures/**',
      ...(asFork ? ['src/profile/**/*.test.ts'] : []),
    ],
    // Listing every source file shows the untested ones at 0% instead of
    // leaving them out. Only the core and the adapters are gated, each a little
    // below its measured baseline so the gate catches regressions, not effort.
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'html'],
      thresholds: {
        'src/core/**': { lines: 96, branches: 90, functions: 96 },
        'src/infrastructure/**': { lines: 97, branches: 91, functions: 98 },
      },
    },
    // Components render in a DOM; everything else stays in plain Node, where
    // the core and the adapters actually run.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: [...configDefaults.exclude, STORE_SUITE],
          environment: 'node',
        },
      },
      ...(storeTests
        ? [
            {
              extends: true as const,
              test: {
                name: 'store',
                include: [STORE_SUITE],
                environment: 'node',
                // One database and two cluster-wide roles per file.
                fileParallelism: false,
                testTimeout: 60_000,
                hookTimeout: 60_000,
                globalSetup: ['./scripts/profile/store/testing/require-admin-url.ts'],
              },
            },
          ]
        : []),
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup-dom.ts'],
        },
      },
    ],
  },
});
