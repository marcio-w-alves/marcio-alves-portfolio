import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import { profile } from '@/profile';
import { topicPath } from '@/site/routes';
import budget from './budgets/client-js.json' with { type: 'json' };

/**
 * What the production build sends the browser. The record is built into the
 * pages on the server, so no script the site loads may carry it, and the
 * scripts the home page needs stay within the budget POR-59 set.
 */

const PAGES = TOPIC_IDS.map(topicPath);
const { experience, notes } = profile.knowledge;

// A probe is a sentence's longest run free of anything a bundler escapes or markdown restyles,
// so finding it in a script, or on the page, needs no unescaping.
const MIN_PROBE_LENGTH = 30;

function probeOf(sentence: string): string {
  const runs = sentence.split(/["'`\\\n*_[\]$<>{}]+/).map((run) => run.trim());
  return runs.reduce((longest, run) => (run.length > longest.length ? run : longest), '');
}

function longest(sentences: readonly { readonly en: string }[]): string | undefined {
  return sentences
    .map(({ en }) => probeOf(en))
    .reduce<string | undefined>(
      (found, probe) => (probe.length > (found?.length ?? 0) ? probe : found),
      undefined,
    );
}

const SHOWN_ON_EXPERIENCE = experience.flatMap((role) => {
  const probe = longest([...role.responsibilities, ...role.achievements]);
  return probe ? [{ company: role.company, probe }] : [];
});

const RECORD_ONLY = [
  ...experience.flatMap((role) => longest(role.highlights) ?? []),
  ...notes.passages.map((passage) => probeOf(passage.text)),
];

const PROBES = [...SHOWN_ON_EXPERIENCE.map(({ probe }) => probe), ...RECORD_ONLY].filter(
  (probe) => probe.length >= MIN_PROBE_LENGTH,
);

interface Script {
  readonly url: string;
  readonly body: Buffer;
}

/** Every script the page loads from the site's own origin on its way to `load`. */
async function scriptsOf(page: Page, path: string, origin: string): Promise<Script[]> {
  const scripts: Promise<Script>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'script') return;
    if (new URL(response.url()).origin !== origin) return;
    scripts.push(response.body().then((body) => ({ url: response.url(), body })));
  });
  await page.goto(path, { waitUntil: 'load' });
  return Promise.all(scripts);
}

function originOf(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('playwright.config.ts must set use.baseURL.');
  return new URL(baseURL).origin;
}

test('the probes are real record sentences: the experience page shows each role’s', async ({
  page,
}) => {
  await page.goto('/experience');

  for (const { company, probe } of SHOWN_ON_EXPERIENCE) {
    const role = page.getByRole('button', { name: new RegExp(`^${RegExp.escape(company)}\\b`) });
    if ((await role.getAttribute('aria-expanded')) === 'false') await role.click();
    await expect(page.getByText(probe).first()).toBeVisible();
  }
  expect(PROBES.length).toBeGreaterThan(experience.length);
});

for (const path of PAGES) {
  test(`no script ${path} loads carries the knowledge base`, async ({ page, baseURL }) => {
    const scripts = await scriptsOf(page, path, originOf(baseURL));

    expect(scripts.length).toBeGreaterThan(0);
    const leaks = scripts.flatMap(({ url, body }) => {
      const source = body.toString('utf8');
      return PROBES.filter((probe) => source.includes(probe)).map((probe) => `${url}: ${probe}`);
    });
    expect(leaks).toEqual([]);
  });
}

test('the home page’s scripts stay within the client-JS budget', async ({ page, baseURL }) => {
  const scripts = await scriptsOf(page, '/', originOf(baseURL));

  const gzipBytes = scripts.reduce((total, { body }) => total + gzipSync(body).length, 0);
  test
    .info()
    .annotations.push({ type: 'client-js', description: `${String(gzipBytes)} B gzipped` });
  expect(gzipBytes).toBeLessThanOrEqual(budget.ceiling.gzipBytes + budget.growthAllowance);
});
