import { expect, test } from '@playwright/test';
import { answers } from './support/assistant';
import {
  fill,
  record,
  resumeUrl,
  topicIntro,
  topicLabel,
  ui,
  welcomeEvidence,
} from './support/profile';

test('a recruiter on a phone reaches contact and the résumé without opening the menu', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const contact = page.getByRole('list', { name: ui.welcome.contact });

  const email = contact.getByRole('link', { name: ui.shell.getInTouch });
  const linkedin = contact.getByRole('link', { name: ui.shell.linkedin });
  const resume = contact.getByRole('link', { name: ui.shell.resume });
  for (const link of [email, linkedin, resume]) await expect(link).toBeInViewport();
  await expect(email).toHaveAttribute(
    'href',
    `mailto:${record.contact.email}?subject=${encodeURIComponent(ui.emailSubject)}`,
  );
  await expect(linkedin).toHaveAttribute('href', record.contact.linkedin);
  await expect(resume).toHaveAttribute('href', resumeUrl());
  await expect(page.getByRole('button', { name: ui.shell.openNavigation })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByRole('navigation', { name: ui.shell.topics })).toBeHidden();

  const pdf = await request.get(resumeUrl());
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 760, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`the evidence line sits above the fold, under the heading, at ${String(viewport.width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1, name: record.welcome.heading });
    const evidence = page.getByRole('list', { name: ui.welcome.evidence });

    await expect(evidence).toBeInViewport({ ratio: 1 });
    const { companies, metrics } = welcomeEvidence();
    for (const text of [...companies, ...metrics.flatMap(({ value, label }) => [value, label])]) {
      await expect(evidence).toContainText(text);
    }
    const headingBox = await heading.boundingBox();
    const evidenceBox = await evidence.boundingBox();
    expect(evidenceBox?.y ?? 0).toBeGreaterThan(headingBox?.y ?? Infinity);
  });
}

test('on a desktop, contact stays in the sidebar rather than on the welcome screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('list', { name: ui.welcome.contact })).toBeHidden();
  await expect(
    page.getByRole('complementary', { name: ui.shell.navigation }).getByRole('link', {
      name: ui.shell.resume,
    }),
  ).toBeVisible();
});

test('the navigation drawer opens from the menu, closes on Escape and leads to a topic', async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: ui.shell.openNavigation });
  const topicsNav = page.getByRole('navigation', { name: ui.shell.topics });
  await expect(topicsNav).toBeHidden();

  await menu.click();

  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(topicsNav).toBeVisible();
  await expect(topicsNav.getByRole('link', { name: topicLabel('overview') })).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(topicsNav).toBeHidden();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();

  await menu.click();
  await topicsNav.getByRole('link', { name: topicLabel('projects') }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(topicsNav).toBeHidden();
  await expect(answers(page).first().getByText(topicIntro('projects'))).toBeVisible();
  await menu.click();
  await expect(topicsNav.getByRole('link', { name: topicLabel('projects') })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

/** The project with the most to fit beside its name: the longest status. */
function widestProject() {
  const [widest] = [...record.projects].sort((a, b) => b.status.length - a.status.length);
  if (!widest) throw new Error('The record documents no project.');
  return widest;
}

test('project cards fit a narrow phone: features wrap inside their chip, the status sits under the name', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/projects');
  const project = widestProject();
  const card = page.getByRole('article', {
    name: fill(ui.rich.project, { project: project.name }),
  });
  await expect(card).toBeVisible();

  for (const chip of await card.getByRole('listitem').all()) {
    const fits = await chip.evaluate((item) => item.scrollHeight <= item.clientHeight + 1);
    expect(fits, await chip.innerText()).toBe(true);
  }

  const name = await card.getByRole('heading', { name: project.name }).boundingBox();
  const status = await card.getByText(project.status, { exact: true }).boundingBox();
  const category = await card.getByText(project.category, { exact: true }).boundingBox();
  expect(status && name && status.y).toBeGreaterThan((name?.y ?? 0) + (name?.height ?? 0));
  expect(category?.height ?? 0).toBeLessThan(24);
});
