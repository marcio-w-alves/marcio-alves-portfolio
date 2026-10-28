import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    restoreMocks: true,
    // A diagnostic, not a gate: listing every source file shows the untested
    // ones at 0% instead of leaving them out.
    coverage: { include: ['src/**/*.{ts,tsx}'], reporter: ['text', 'html'] },
    // Components render in a DOM; everything else stays in plain Node, where
    // the core and the adapters actually run.
    projects: [
      {
        extends: true,
        test: { name: 'node', include: ['src/**/*.test.ts'], environment: 'node' },
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
