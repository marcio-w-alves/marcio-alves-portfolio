import type { Brand } from '@/site/site-profile';

/**
 * The design's colours and the face of the generated images. The share image
 * and the tab icon read them here; until the stylesheet's tokens are generated
 * from this file, a test keeps the two equal.
 */
export const brand: Brand = {
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
  },
  imageFont: {
    family: 'Inter Tight',
    files: {
      400: '@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff',
      600: '@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff',
    },
  },
};
