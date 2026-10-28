/**
 * The Tailwind plugin sorts class lists into the canonical order. Tailwind v4
 * has no JavaScript config, so the plugin is pointed at the stylesheet that
 * declares the theme instead.
 */
const prettierConfig = {
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/app/globals.css',
  tailwindFunctions: ['cn', 'cva'],
};

export default prettierConfig;
