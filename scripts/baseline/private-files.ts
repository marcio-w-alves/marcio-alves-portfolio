import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * A baseline holds the owner's pages, answers and files: only the owner's
 * account may read it.
 */
const PRIVATE_DIR = 0o700;
const PRIVATE_FILE = 0o600;

export async function makePrivateDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: PRIVATE_DIR });
}

export async function writePrivateFile(path: string, data: string | Uint8Array): Promise<void> {
  await makePrivateDir(dirname(path));
  await writeFile(path, data, { mode: PRIVATE_FILE });
}

export async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await writePrivateFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}
