import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const APP_URL = process.env.APP_URL ?? `http://localhost:${String(PORT)}`;

/**
 * The motion checks: how the interface moves, and that it stops moving for a
 * visitor who asks it to. Chromium only, because they slow animations down
 * through the DevTools protocol.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'motion.spec.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: { ...devices['Desktop Chrome'], baseURL: APP_URL, trace: 'retain-on-failure' },
  webServer: {
    command: `pnpm dev --port ${String(PORT)}`,
    url: APP_URL,
    reuseExistingServer: true,
  },
});
