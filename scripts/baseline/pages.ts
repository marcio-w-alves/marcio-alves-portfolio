import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext } from '@playwright/test';
import { captureFiles, fileOf } from './capture-layout';
import type { PageInput } from './inputs';
import { makePrivateDir, writePrivateFile } from '../profile/home';
import { writePrivateJson } from './private-files';

/**
 * Every page in a real browser, as a visitor sees it once it has loaded: its
 * document, the design tokens it computes, and full-page screenshots at a
 * desktop and a phone width, in the light and the dark theme. Motion is
 * reduced and animations stopped, so two captures of one build are identical.
 */

export interface View {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly colorScheme: 'light' | 'dark';
}

export const VIEWS: readonly View[] = [
  { name: '1280x800-light', width: 1280, height: 800, colorScheme: 'light' },
  { name: '1280x800-dark', width: 1280, height: 800, colorScheme: 'dark' },
  { name: '390x844-light', width: 390, height: 844, colorScheme: 'light' },
  { name: '390x844-dark', width: 390, height: 844, colorScheme: 'dark' },
];

/** The document is read once, in the first view; the others add tokens and pixels. */
const DOCUMENT_VIEW = VIEWS[0];

export interface CapturedPage {
  readonly asked: PageInput;
  readonly status: number | null;
  readonly html: string;
}

const NAVIGATION_TIMEOUT_MS = 60_000;

export const screenFiles = (dir: string, pageId: string, view: string) => {
  const folder = join(captureFiles(dir).screens, fileOf(pageId, ''));
  return { folder, png: join(folder, `${view}.png`), tokens: join(folder, `${view}.json`) };
};

export const pageFile = (dir: string, pageId: string) =>
  join(captureFiles(dir).pages, fileOf(pageId, '.json'));

export async function capturePages(pages: readonly PageInput[], target: URL, dir: string) {
  const browser = await chromium.launch();
  try {
    for (const view of VIEWS) await captureView(browser, view, pages, target, dir);
  } finally {
    await browser.close();
  }
}

async function captureView(
  browser: Browser,
  view: View,
  pages: readonly PageInput[],
  target: URL,
  dir: string,
) {
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    colorScheme: view.colorScheme,
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  try {
    for (const asked of pages) {
      if (await exists(screenFiles(dir, asked.id, view.name).png)) continue;
      await capturePage(context, view, asked, target, dir);
    }
  } finally {
    await context.close();
  }
}

async function capturePage(
  context: BrowserContext,
  view: View,
  asked: PageInput,
  target: URL,
  dir: string,
) {
  const page = await context.newPage();
  // Prefetches of other pages load their payloads, never this page's content.
  // On a Portuguese page they repeat without end (thousands a second), so the
  // network would never go idle and production would be flooded. The page's
  // own payload stays: the not-found page renders from it.
  await page.route(
    (url) => url.searchParams.has('_rsc') && url.pathname !== asked.path,
    (route) => route.abort(),
  );
  try {
    const response = await page.goto(new URL(asked.path, target).href, {
      waitUntil: 'networkidle',
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const files = screenFiles(dir, asked.id, view.name);
    await makePrivateDir(files.folder);
    await writePrivateJson(files.tokens, await page.evaluate<unknown>(DESIGN_TOKENS));
    if (view === DOCUMENT_VIEW) {
      const captured: CapturedPage = {
        asked,
        status: response?.status() ?? null,
        html: await page.content(),
      };
      await writePrivateJson(pageFile(dir, asked.id), captured);
    }
    const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
    await writePrivateFile(files.png, png);
  } finally {
    await page.close();
  }
}

/**
 * Every `--color-*` and `--font-*` custom property a stylesheet declares, as
 * the root computes it. A string, not a function: tsx wraps named functions in
 * a helper that does not exist in the page.
 */
const DESIGN_TOKENS = `(() => {
  const names = new Set();
  const visit = (rules) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        for (const name of Array.from(rule.style)) {
          if (/^--(color|font)-/.test(name)) names.add(name);
        }
      }
      if ('cssRules' in rule) visit(rule.cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) visit(sheet.cssRules);
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries([...names].sort().map((name) => [name, style.getPropertyValue(name).trim()]));
})()`;

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}
