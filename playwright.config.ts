import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${String(PORT)}`;
const inCI = Boolean(process.env.CI);

/**
 * Critical journeys only, in a real browser against a production build: what
 * a visitor gets is what `next build` produced, not the development server.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 2 : 0,
  reporter: inCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Assertions read end states; the motion itself is not under test.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile/ },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /mobile/,
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${String(PORT)}`,
    url: `${BASE_URL}/api/health`,
    // A fresh server per run: the per-client request limit is in memory, and a
    // reused one would carry the previous run's requests into this one.
    reuseExistingServer: false,
    timeout: 240_000,
    // An empty key is "not set" to the app and, being defined, is not filled
    // in from .env.local: the assistant answers from the fast path alone, so a
    // run never reaches OpenAI.
    env: { OPENAI_API_KEY: '', GITHUB_TOKEN: '', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
