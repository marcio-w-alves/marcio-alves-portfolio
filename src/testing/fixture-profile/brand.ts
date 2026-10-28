import type { Brand } from '@/site/site-profile';

/** A fictional palette, unlike the owner's, so a test can tell which brand drew an image. */
export const fixtureBrand: Brand = {
  colors: {
    bg: '#fdf8f0',
    ice: '#f5efe4',
    surface: '#fffdf9',
    fill: '#efe6d8',
    'fill-hover': '#e8dcc9',
    selection: '#e0d2bb',
    ink: '#2a1d3a',
    'ink-muted': '#6b5d7a',
    'ink-faint': '#a99bb8',
    border: '#e9dfcf',
    'border-strong': '#dccfba',
    'border-hover': '#cbbba2',
    accent: '#7a2e8c',
    'accent-hover': '#5f2370',
    'accent-soft': '#f1e4f4',
    danger: '#a3261a',
    'danger-soft': '#fbefed',
    'danger-ring': '#f2d3cf',
  },
  imageFont: {
    family: 'Inter Tight',
    files: {
      400: '@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff',
      600: '@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff',
    },
  },
};
