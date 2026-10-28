import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),

  ...nextVitals,
  ...nextTs,

  /**
   * Type-aware linting. These rules read the type checker rather than the
   * syntax tree, which is what lets them catch a floating promise or a
   * needless condition — the defects that cost real debugging time.
   */
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `const { source: _source, ...rest } = record` is how a property is
      // omitted; the named sibling exists only to be left out.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },

  // A test double implements an async interface without doing anything
  // asynchronous — that is the point of a double.
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },

  // Config and tooling files run in Node, outside the app's type program.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Formatting belongs to Prettier alone, so this must stay last.
  prettier,
]);
