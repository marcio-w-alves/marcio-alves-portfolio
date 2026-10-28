import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    restoreMocks: true,
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
          environment: 'node',
        },
      },
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
