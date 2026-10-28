import { expect, test } from '@playwright/test';
import { answers, composer } from './support/assistant';

test('a topic is a page of its own: its record, its questions, and the home conversation left intact', async ({
  page,
}) => {
  await page.goto('/');
  const topicsNav = page.getByRole('navigation', { name: 'Topics' });
  await expect(topicsNav.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await composer(page).fill('How did he grow the team at Roots?');
  await composer(page).press('Enter');
  await expect(
    answers(page)
      .last()
      .getByText(/grew the frontend team/),
  ).toBeVisible();

  await topicsNav.getByRole('link', { name: 'Experience' }).click();

  await expect(page).toHaveURL(/\/experience$/);
  await expect(page).toHaveTitle('Experience — Marcio Alves');
  await expect(topicsNav.getByRole('link', { name: 'Experience' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('How did he grow the team at Roots?')).toBeHidden();
  const intro = answers(page).first();
  await expect(
    intro.getByText('from freelance web development to lead and senior frontend roles'),
  ).toBeVisible();
  await expect(intro.getByText('Senior Frontend Engineer').first()).toBeVisible();
  const suggestions = intro.getByRole('list', { name: 'Suggested questions' });
  await expect(suggestions.getByRole('button', { name: 'What did he do at Roots?' })).toBeVisible();

  await topicsNav.getByRole('link', { name: 'Overview' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('How did he grow the team at Roots?')).toBeVisible();
});

test('a topic page opens directly from its address, and any other address is not found', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(
    answers(page).first().getByText('Beyond his day job, Marcio builds his own products.'),
  ).toBeVisible();

  const missing = await page.goto('/not-a-topic');
  expect(missing?.status()).toBe(404);
});
