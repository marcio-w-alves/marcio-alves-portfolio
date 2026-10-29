import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { captureFiles, fileOf, idsIn } from './capture-layout';
import type { RouteInput } from './inputs';
import { writePrivateFile, writePrivateJson } from './private-files';

/** A metadata route or a file, as the site serves it: status, type and exact bytes. */
export interface CapturedRoute {
  readonly asked: RouteInput;
  readonly status: number;
  readonly contentType: string | null;
  readonly sha256: string;
  readonly size: number;
}

const REQUEST_TIMEOUT_MS = 30_000;

export const routeBodyFile = (dir: string, id: string) =>
  join(captureFiles(dir).routes, fileOf(id, '.body'));

/** Fetches every route not captured yet; redirects are recorded, not followed. */
export async function captureRoutes(inputs: readonly RouteInput[], target: URL, dir: string) {
  const folder = captureFiles(dir).routes;
  const captured = new Set(await idsIn(folder, '.json'));
  for (const asked of inputs) {
    if (captured.has(asked.id)) continue;
    const response = await fetch(new URL(asked.path, target), {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writePrivateFile(routeBodyFile(dir, asked.id), bytes);
    const route: CapturedRoute = {
      asked,
      status: response.status,
      contentType: response.headers.get('content-type'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.byteLength,
    };
    await writePrivateJson(join(folder, fileOf(asked.id, '.json')), route);
  }
}
