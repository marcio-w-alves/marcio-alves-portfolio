import { defineConfig, devices } from '@playwright/test';

// A port of its own, so a development server already running elsewhere is
// never mistaken for the production build these checks are about.
const PORT = 4310;
const BASE_URL = `http://localhost:${String(PORT)}`;

/**
 * Accessibility, security and search checks against a production build: the
 * markup, headers and policy a visitor actually receives, which a development
 * server does not serve.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['a11y.spec.ts', 'security.spec.ts', 'seo.spec.ts'],
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${String(PORT)}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
