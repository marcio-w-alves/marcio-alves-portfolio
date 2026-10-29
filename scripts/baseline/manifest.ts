import { readFile } from 'node:fs/promises';
import { captureFiles } from './capture-layout';
import { writePrivateJson } from './private-files';

/** Bumped whenever what a capture records, or how, changes. */
export const BASELINE_TOOL_VERSION = '1';

/** Where a capture came from. Written last: a capture without one is unfinished. */
export interface CaptureManifest {
  /** The commit the captured build was made from. */
  readonly commit: string;
  /** Whether the checkout had uncommitted changes, as a planted edit does; null without one. */
  readonly dirty: boolean | null;
  readonly date: string;
  readonly target: string;
  readonly tool: { readonly version: string; readonly commit: string };
  /** False when no checkout was given, so the search could not run offline. */
  readonly retrieval: boolean;
  readonly evaluation: 'run' | 'skipped' | 'not-run';
}

export class MissingManifestError extends Error {
  constructor(dir: string) {
    super(
      `${dir} has no manifest.json: it is not a finished capture. ` +
        'A capture writes its manifest last; run it again to finish it.',
    );
    this.name = 'MissingManifestError';
  }
}

export async function writeManifest(dir: string, manifest: CaptureManifest): Promise<void> {
  await writePrivateJson(captureFiles(dir).manifest, manifest);
}

export async function readManifest(dir: string): Promise<CaptureManifest> {
  const text = await readFile(captureFiles(dir).manifest, 'utf8').catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new MissingManifestError(dir);
    throw error;
  });
  return JSON.parse(text) as CaptureManifest;
}
