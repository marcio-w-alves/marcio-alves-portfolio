/**
 * The fidelity gate: each board's candidate page is rendered at the board's
 * exact size and compared with the stored reference, pixel by pixel. A pixel
 * counts as different when its perceptual colour distance passes pixelmatch's
 * threshold; anti-aliased edges are detected and left out, so the budget is
 * spent on real differences, not on rasterizer noise. Every board must match
 * on at least 99.9% of its pixels.
 *
 *   pnpm dev   # in another terminal
 *   pnpm fidelity [BoardName …]
 *
 * With --live, the boards production renders as they are (the welcome
 * screen, desktop and phone) are checked against the live site instead:
 *   pnpm fidelity:live
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { BOARDS, FREEZE_CSS } from './boards';

const live = process.argv.includes('--live');
const APP_URL = live
  ? (process.env.LIVE_URL ?? 'https://marciomariani.dev')
  : (process.env.APP_URL ?? 'http://localhost:3000');
const THRESHOLD = 0.999;
const REFERENCES = new URL('../../fidelity/reference/', import.meta.url);
const OUT = join(tmpdir(), 'fidelity');
// The development build's overlay is not part of the page.
const HIDE_DEV_UI = 'nextjs-portal{display:none!important}';

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const only = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('--')));
const boards = BOARDS.filter(
  ({ name, liveRoute }) => (live ? liveRoute : true) && (only.size === 0 || only.has(name)),
);
const results: { name: string; ratio: number; note: string }[] = [];

for (const board of boards) {
  const reference = PNG.sync.read(await readFile(new URL(`${board.name}.png`, REFERENCES)));
  const page = await browser.newPage({ viewport: { width: board.width, height: board.height } });
  const route = live ? (board.liveRoute ?? board.route) : board.route;
  const response = await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle' });
  if (!response?.ok()) {
    results.push({ name: board.name, ratio: 0, note: `no candidate at ${route}` });
    await page.close();
    continue;
  }
  await page.addStyleTag({ content: FREEZE_CSS + HIDE_DEV_UI });
  await page.evaluate(() => document.fonts.ready);
  const candidate = PNG.sync.read(await page.screenshot());
  await page.close();

  const { width, height } = reference;
  const diff = new PNG({ width, height });
  const different = pixelmatch(reference.data, candidate.data, diff.data, width, height, {
    threshold: 0.1,
    includeAA: false,
  });
  const ratio = 1 - different / (width * height);
  await writeFile(join(OUT, `${board.name}-candidate.png`), PNG.sync.write(candidate));
  await writeFile(join(OUT, `${board.name}-diff.png`), PNG.sync.write(diff));
  results.push({ name: board.name, ratio, note: `${String(different)} px differ` });
}
await browser.close();

for (const { name, ratio, note } of results) {
  const mark = ratio >= THRESHOLD ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name.padEnd(20)} ${(ratio * 100).toFixed(3).padStart(7)}%  ${note}`);
}
console.log(`\nCandidates and diffs: ${OUT}`);
process.exitCode = results.every(({ ratio }) => ratio >= THRESHOLD) ? 0 : 1;
