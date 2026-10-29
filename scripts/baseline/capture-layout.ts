import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Where each part of a capture lives inside its directory. One file per
 * input, named after the input's id, so a capture resumes where it stopped
 * and a comparison sees at once which inputs a capture lacks.
 */
export const captureFiles = (dir: string) => ({
  manifest: join(dir, 'manifest.json'),
  inputs: join(dir, 'inputs.json'),
  retrieval: join(dir, 'retrieval.json'),
  answers: join(dir, 'answers'),
  pages: join(dir, 'pages'),
  screens: join(dir, 'screens'),
  routes: join(dir, 'routes'),
  evaluation: join(dir, 'evaluation'),
});

export function fileOf(id: string, extension: string): string {
  return `${encodeURIComponent(id)}${extension}`;
}

/** The ids a folder holds files for; none when the folder does not exist. */
export async function idsIn(folder: string, extension: string): Promise<string[]> {
  const names = await readdir(folder).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  return names
    .filter((name) => name.endsWith(extension))
    .map((name) => decodeURIComponent(name.slice(0, name.length - extension.length)))
    .sort();
}
