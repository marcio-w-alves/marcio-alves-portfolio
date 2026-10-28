import { expect, test } from '@playwright/test';
import { answers } from './support/assistant';

test('picking a topic introduces it, offers its questions and marks it current', async ({
  page,
}) => {
  await page.goto('/');
  const topicsNav = page.getByRole('navigation', { name: 'Topics' });
  const experience = topicsNav.getByRole('button', { name: 'Experience' });
  await expect(topicsNav.getByRole('button', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'true',
  );

  await experience.click();

  await expect(experience).toHaveAttribute('aria-current', 'true');
  await expect(topicsNav.getByRole('button', { name: 'Overview' })).not.toHaveAttribute(
    'aria-current',
  );
  const intro = answers(page).last();
  await expect(
    intro.getByText('from freelance web development to lead and senior frontend roles'),
  ).toBeVisible();
  const suggestions = intro.getByRole('list', { name: 'Suggested questions' });
  await expect(suggestions.getByRole('button', { name: 'What did he do at Roots?' })).toBeVisible();
});
