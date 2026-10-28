/**
 * Renders every artboard of the design and stores it as the reference the
 * fidelity check compares against. Needs the design's files served locally
 * (the canvas `project/` folder, with the board runtime as `support.js`):
 *   DESIGN_URL=http://localhost:4410 pnpm fidelity:references
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { knowledgeBase } from '../../src/core/knowledge/knowledge-base';
import { BOARDS, FREEZE_CSS } from './boards';

const DESIGN_URL = process.env.DESIGN_URL ?? 'http://localhost:4410';
const OUT = new URL('../../fidelity/reference/', import.meta.url);
// Boards load their fonts and their imported boards after the first paint.
const SETTLE_MS = 2500;
// "Preview with scripted answers" is the prototype describing itself; the
// product answers for real, so the reference is taken as with the
// prototype's own `showMockNotice` switched off. Out of the flex row, it
// leaves the layout exactly as if it were never rendered.
const WITHOUT_PROTOTYPE_NOTICE = '.ma-helper-note{display:none!important}';

/**
 * The design renders with its own sample contact data, which differs from
 * production on purpose in two places: GitHub is linked (an explicit
 * requirement the design's data leaves out) and the résumé is not published
 * yet. The design's own logic is run with the production contact, so the
 * reference shows what the design does with the real data.
 */
const PRODUCTION_CONTACT = `Object.assign(window.MAPortfolio.kb.contact, ${JSON.stringify({
  github: knowledgeBase.contact.github,
  resumeUrl: knowledgeBase.contact.resumeUrl,
})});`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const only = new Set(process.argv.slice(2));

for (const board of BOARDS.filter(({ name }) => only.size === 0 || only.has(name))) {
  const page = await browser.newPage({ viewport: { width: board.width, height: board.height } });
  await page.route('**/lib/knowledge-base.js', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n${PRODUCTION_CONTACT}` });
  });
  await page.goto(`${DESIGN_URL}/${board.name}.dc.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SETTLE_MS);
  await page.addStyleTag({ content: FREEZE_CSS + WITHOUT_PROTOTYPE_NOTICE });
  await page.screenshot({ path: new URL(`${board.name}.png`, OUT).pathname });
  await page.close();
  console.log(`captured ${board.name} (${String(board.width)}×${String(board.height)})`);
}

await browser.close();
