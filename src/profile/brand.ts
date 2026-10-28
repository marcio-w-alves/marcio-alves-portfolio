import type { Brand } from '@/site/site-profile';

/**
 * The design's colours, font families and the face of the generated images.
 * `pnpm brand:css` writes the stylesheet's tokens from this file; the share
 * image and the tab icon read it directly.
 */
export const brand: Brand = {
  // "White & Ice": white surfaces, cool ice neutrals, and ink as the only
  // accent. `ink-muted` holds 5.5:1 or better on every surface.
  colors: {
    bg: '#ffffff',
    ice: '#f9fafb',
    surface: '#ffffff',
    fill: '#f4f6f8',
    'fill-hover': '#eef1f4',
    selection: '#e2e8f0',
    ink: '#0f1115',
    'ink-muted': '#5b616b',
    'ink-faint': '#a3a9b1',
    border: '#eceff2',
    'border-strong': '#dfe3e8',
    'border-hover': '#c7ced6',
    accent: '#0f1115',
    'accent-hover': '#2b2f36',
    'accent-soft': '#eef2f6',
    danger: '#b42318',
    'danger-soft': '#fef5f4',
    'danger-ring': '#f9dcd8',
    'on-accent': '#ffffff',
    shadow: '#0f1115',
  },
  // The same structure at night: cool graphite surfaces stepping up in
  // lightness, ink turned to a soft white, and that white as the accent.
  // `ink-muted` holds 7:1 or better on every surface.
  darkColors: {
    bg: '#0e1013',
    ice: '#13161a',
    surface: '#171a1f',
    fill: '#1d2127',
    'fill-hover': '#242930',
    selection: '#2e3744',
    ink: '#e9ecf0',
    'ink-muted': '#a3aab4',
    'ink-faint': '#636a74',
    border: '#22262c',
    'border-strong': '#2b3037',
    'border-hover': '#3b414a',
    accent: '#e9ecf0',
    'accent-hover': '#cdd2d8',
    'accent-soft': '#1f242b',
    danger: '#f97066',
    'danger-soft': '#2a1715',
    'danger-ring': '#5b2621',
    'on-accent': '#0e1013',
    shadow: '#000000',
  },
  // After the faces in fonts.ts: Inter for text, Inter Tight for display,
  // Geist Mono for code. Inter's character variants come with the stack.
  fonts: {
    sans: {
      fallbacks: [
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        "'Segoe UI'",
        'Roboto',
        'sans-serif',
      ],
      featureSettings: "'cv11', 'ss01', 'ss03'",
    },
    display: {
      fallbacks: [
        'var(--font-face-text)',
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'sans-serif',
      ],
    },
    mono: { fallbacks: ['ui-monospace', "'SF Mono'", 'Menlo', 'Consolas', 'monospace'] },
  },
  imageFont: {
    family: 'Inter Tight',
    files: {
      400: '@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff',
      600: '@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff',
    },
  },
};
