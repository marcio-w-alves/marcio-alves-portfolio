import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The image renderer reads WOFF, not the WOFF2 next/font serves the page.
const interTight = (weight: 400 | 600) =>
  readFile(
    join(
      process.cwd(),
      `node_modules/@fontsource/inter-tight/files/inter-tight-latin-${String(weight)}-normal.woff`,
    ),
  );

// Read when the module loads, not inside an image handler: a file read there
// would make the image render on every request instead of once, at build.
const [regular, semibold] = await Promise.all([interTight(400), interTight(600)]);

/** The display face, for images generated with next/og. */
export const imageFonts = [
  { name: 'Inter Tight', data: regular, weight: 400, style: 'normal' },
  { name: 'Inter Tight', data: semibold, weight: 600, style: 'normal' },
] as const;
