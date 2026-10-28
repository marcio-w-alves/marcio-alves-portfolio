import { expect, test } from '@playwright/test';
import { answers, composer } from './support/assistant';
import {
  fill,
  firstSuggestion,
  record,
  site,
  topicIntro,
  topicLabel,
  topicQuestions,
  ui,
  youAsked,
} from './support/profile';

test('a topic is a page of its own: its record, its questions, and the home conversation left intact', async ({
  page,
}) => {
  await page.goto('/');
  const topicsNav = page.getByRole('navigation', { name: ui.shell.topics });
  await expect(topicsNav.getByRole('link', { name: topicLabel('overview') })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const { question } = firstSuggestion();
  await composer(page).fill(question);
  await composer(page).press('Enter');
  await expect(answers(page).last().getByRole('group', { name: ui.actions.group })).toBeVisible();

  await topicsNav.getByRole('link', { name: topicLabel('experience') }).click();

  await expect(page).toHaveURL(/\/experience$/);
  await expect(page).toHaveTitle(fill(site.topicTitle, { topic: topicLabel('experience') }));
  await expect(topicsNav.getByRole('link', { name: topicLabel('experience') })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText(youAsked(question))).toBeHidden();
  const intro = answers(page).first();
  await expect(intro.getByText(topicIntro('experience'))).toBeVisible();
  const [currentRole] = record.experience;
  await expect(intro.getByText(currentRole?.role ?? '').first()).toBeVisible();
  const suggestions = intro.getByRole('list', { name: ui.welcome.suggestedQuestions });
  const offered = await suggestions.getByRole('button').first().innerText();
  expect(topicQuestions('experience')).toContain(offered);

  await topicsNav.getByRole('link', { name: topicLabel('overview') }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(youAsked(question))).toBeVisible();
});

test('a topic page opens directly from its address, and any other address is not found', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(answers(page).first().getByText(topicIntro('projects'))).toBeVisible();

  const missing = await page.goto('/not-a-topic');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: site.notFound.title })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test("an address under the API or Next's assets is not found, not an error", async ({
  request,
}) => {
  for (const path of ['/api', '/api/nope', '/_next/nope']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
