import { expect, test } from '@playwright/test';
import { answers } from './support/assistant';
import { fill, record, topicIntro, topicLabel, ui } from './support/profile';

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
