import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImageFont } from './site-profile';

const WEIGHTS = [400, 600] as const;

/** The image face's files, read for the next/og renderer. */
export async function loadImageFonts({ family, files }: ImageFont) {
  return Promise.all(
    WEIGHTS.map(async (weight) => ({
      name: family,
      data: await readFile(join(process.cwd(), 'node_modules', files[weight])),
      weight,
      style: 'normal' as const,
    })),
  );
}

export type ImageFonts = Awaited<ReturnType<typeof loadImageFonts>>;
