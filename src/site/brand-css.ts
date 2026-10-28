import type { Brand, FontRole } from './site-profile';

/** The variable `fonts.ts` defines for each family's own face. */
const FACE_VARIABLES: Readonly<Record<FontRole, string>> = {
  sans: '--font-face-text',
  display: '--font-face-display',
  mono: '--font-face-code',
};

const FONT_ROLES: readonly FontRole[] = ['sans', 'display', 'mono'];

const BANNER = [
  '/*',
  ' * Generated from src/profile/brand.ts by `pnpm brand:css`. Do not edit:',
  ' * change the profile and run the command again.',
  ' */',
];

function colorTokens({ colors }: Brand): string[] {
  return Object.entries(colors).map(([token, hex]) => `  --color-${token}: ${hex};`);
}

function fontTokens({ fonts }: Brand): string[] {
  return FONT_ROLES.flatMap((role) => {
    const { fallbacks, featureSettings } = fonts[role];
    const stack = [`var(${FACE_VARIABLES[role]})`, ...fallbacks].join(', ');
    const family = `  --font-${role}: ${stack};`;
    return featureSettings === undefined
      ? [family]
      : [family, `  --font-${role}--font-feature-settings: ${featureSettings};`];
  });
}

/**
 * The brand as Tailwind theme tokens: a `--color-*` per colour and a
 * `--font-*` per family, so every utility over them follows the profile.
 */
export function renderBrandCss(brand: Brand): string {
  return [...BANNER, '@theme {', ...colorTokens(brand), '', ...fontTokens(brand), '}', ''].join(
    '\n',
  );
}
