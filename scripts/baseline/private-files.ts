import { readFile } from 'node:fs/promises';
import { writePrivateFile } from '../profile/home';

/** A baseline holds the owner's pages, answers and files: only the owner's account may read it. */
export async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await writePrivateFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}
