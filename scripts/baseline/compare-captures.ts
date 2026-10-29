import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CapturedAnswer } from './answers';
import { captureFiles, fileOf, idsIn } from './capture-layout';
import { changed, fromJsonChange, presence, type Difference } from './difference';
import { compareDocuments } from './dom-diff';
import type { RetrievalResult } from './inputs';
import { diffJson } from './json-diff';
import { pageFile, screenFiles, type CapturedPage } from './pages';
import { comparePixels, describePixels, pixelsDiffer } from './pixels';
import { readJson } from './private-files';
import { routeBodyFile, type CapturedRoute } from './routes';
import { compareSitemaps } from './sitemap';

/**
 * Every difference between a baseline capture and a target capture of the
 * same inputs. An input one side has and the other lacks is a difference
 * too. Notes say what could not be compared at all.
 */
export interface Comparison {
  readonly differences: readonly Difference[];
  readonly notes: readonly string[];
}

export async function compareCaptures(baseline: string, target: string): Promise<Comparison> {
  const retrieval = await compareRetrieval(baseline, target);
  return {
    differences: [
      ...(await compareAnswers(baseline, target)),
      ...(await comparePages(baseline, target)),
      ...(await compareScreens(baseline, target)),
      ...(await compareRoutes(baseline, target)),
      ...retrieval.differences,
    ],
    notes: retrieval.notes,
  };
}

async function compareAnswers(baseline: string, target: string): Promise<Difference[]> {
  const folder = (dir: string) => captureFiles(dir).answers;
  const { differences, common } = presence(
    'answer',
    await idsIn(folder(baseline), '.json'),
    await idsIn(folder(target), '.json'),
  );
  const read = (dir: string, id: string) =>
    readJson<CapturedAnswer>(join(folder(dir), fileOf(id, '.json')));
  for (const id of common) {
    const [before, after] = await Promise.all([read(baseline, id), read(target, id)]);
    differences.push(
      ...diffJson(before.observed, after.observed).map((change) =>
        fromJsonChange(`answer:${id}`, change),
      ),
    );
  }
  return differences;
}

async function comparePages(baseline: string, target: string): Promise<Difference[]> {
  const folder = (dir: string) => captureFiles(dir).pages;
  const { differences, common } = presence(
    'page',
    await idsIn(folder(baseline), '.json'),
    await idsIn(folder(target), '.json'),
  );
  for (const id of common) {
    const [before, after] = await Promise.all([
      readJson<CapturedPage>(pageFile(baseline, id)),
      readJson<CapturedPage>(pageFile(target, id)),
    ]);
    if (before.status !== after.status) {
      differences.push(
        changed(`page:${id}#status`, `${String(before.status)} → ${String(after.status)}`),
      );
    }
    differences.push(
      ...compareDocuments(before.html, after.html).map(({ path, detail }) =>
        changed(`page:${id}#${path}`, detail),
      ),
    );
  }
  return differences;
}

async function compareScreens(baseline: string, target: string): Promise<Difference[]> {
  const folder = (dir: string) => captureFiles(dir).screens;
  const { differences, common } = presence(
    'screens',
    await idsIn(folder(baseline), ''),
    await idsIn(folder(target), ''),
  );
  for (const pageId of common) {
    differences.push(...(await compareViews(baseline, target, pageId)));
  }
  return differences;
}

async function compareViews(baseline: string, target: string, pageId: string) {
  const folder = (dir: string) => screenFiles(dir, pageId, '').folder;
  const { differences, common } = presence(
    `screen:${pageId}`,
    await idsIn(folder(baseline), '.png'),
    await idsIn(folder(target), '.png'),
  );
  for (const view of common) {
    const [before, after] = [
      screenFiles(baseline, pageId, view),
      screenFiles(target, pageId, view),
    ];
    const pixels = comparePixels(await readFile(before.png), await readFile(after.png));
    if (pixelsDiffer(pixels))
      differences.push(changed(`screen:${pageId}/${view}`, describePixels(pixels)));
    const tokens = diffJson(await readJson(before.tokens), await readJson(after.tokens));
    differences.push(...tokens.map((change) => fromJsonChange(`tokens:${pageId}/${view}`, change)));
  }
  return differences;
}

async function compareRoutes(baseline: string, target: string): Promise<Difference[]> {
  const folder = (dir: string) => captureFiles(dir).routes;
  const { differences, common } = presence(
    'route',
    await idsIn(folder(baseline), '.json'),
    await idsIn(folder(target), '.json'),
  );
  const read = (dir: string, id: string) =>
    readJson<CapturedRoute>(join(folder(dir), fileOf(id, '.json')));
  for (const id of common) {
    const [before, after] = await Promise.all([read(baseline, id), read(target, id)]);
    differences.push(...(await compareRoute(id, before, after, baseline, target)));
  }
  return differences;
}

async function compareRoute(
  id: string,
  before: CapturedRoute,
  after: CapturedRoute,
  baseline: string,
  target: string,
): Promise<Difference[]> {
  const location = `route:${id}`;
  const differences: Difference[] = [];
  if (before.status !== after.status) {
    differences.push(
      changed(`${location}#status`, `${String(before.status)} → ${String(after.status)}`),
    );
  }
  if (before.contentType !== after.contentType) {
    differences.push(
      changed(
        `${location}#content-type`,
        `${String(before.contentType)} → ${String(after.contentType)}`,
      ),
    );
  }
  if (before.sha256 === after.sha256) return differences;
  const [beforeBytes, afterBytes] = await Promise.all([
    readFile(routeBodyFile(baseline, id)),
    readFile(routeBodyFile(target, id)),
  ]);
  return [...differences, ...bodyDifferences(location, before, after, beforeBytes, afterBytes)];
}

/** Bytes differ: say where, in the terms of what the route serves. */
function bodyDifferences(
  location: string,
  before: CapturedRoute,
  after: CapturedRoute,
  beforeBytes: Buffer,
  afterBytes: Buffer,
): Difference[] {
  const hashes = `sha256 ${before.sha256} → ${after.sha256}`;
  if (before.asked.kind === 'sitemap') {
    const changes = compareSitemaps(beforeBytes.toString('utf8'), afterBytes.toString('utf8'));
    if (changes.length > 0) {
      return changes.map(({ path, detail }) => changed(`${location}#${path}`, detail));
    }
  }
  if (before.asked.kind === 'image' && isPng(before) && isPng(after)) {
    return [
      changed(
        `${location}#bytes`,
        `${hashes} (${describePixels(comparePixels(beforeBytes, afterBytes))})`,
      ),
    ];
  }
  return [changed(`${location}#bytes`, hashes)];
}

function isPng({ contentType }: CapturedRoute): boolean {
  return contentType?.startsWith('image/png') ?? false;
}

async function compareRetrieval(baseline: string, target: string): Promise<Comparison> {
  const [before, after] = await Promise.all([readRetrieval(baseline), readRetrieval(target)]);
  if (!before || !after) {
    const without = before ? 'the target' : 'the baseline';
    return {
      differences: [],
      notes: [`Retrieval not compared: ${without} was captured without --checkout.`],
    };
  }
  const byProbe = (results: readonly RetrievalResult[]) =>
    new Map(results.map((result) => [result.probe, result.results]));
  const [beforeByProbe, afterByProbe] = [byProbe(before), byProbe(after)];
  const { differences, common } = presence(
    'retrieval',
    [...beforeByProbe.keys()],
    [...afterByProbe.keys()],
  );
  for (const probe of common) {
    differences.push(
      ...diffJson(beforeByProbe.get(probe), afterByProbe.get(probe)).map((change) =>
        fromJsonChange(`retrieval:${probe}`, change),
      ),
    );
  }
  return { differences, notes: [] };
}

async function readRetrieval(dir: string): Promise<readonly RetrievalResult[] | null> {
  return readJson<RetrievalResult[]>(captureFiles(dir).retrieval).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  });
}
