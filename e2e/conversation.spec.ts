import { expect, test } from '@playwright/test';
import { answers, composer, holdNextAnswer, sendButton, stopButton } from './support/assistant';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('a suggested question streams in as a rich answer, and a follow-up continues the conversation', async ({
  page,
}) => {
  const releaseAnswer = await holdNextAnswer(page);
  await page.getByRole('button', { name: 'His career' }).click();

  await expect(page.getByText("You asked: Tell me about Marcio's career.")).toBeVisible();
  await expect(page.getByText("Reading Marcio's documented experience…")).toBeVisible();
  await expect(stopButton(page)).toBeVisible();

  releaseAnswer();
  const careerAnswer = answers(page).first();
  await expect(
    careerAnswer.getByText('Marcio is a frontend engineer with over 10 years'),
  ).toBeVisible();
  await expect(stopButton(page)).toBeHidden();
  await expect(sendButton(page)).toBeVisible();

  const timeline = careerAnswer.getByRole('region', { name: 'Career timeline' });
  const deel = timeline.getByRole('button', { name: /^Deel Senior Frontend Engineer/ });
  await expect(deel).toHaveAttribute('aria-expanded', 'false');
  await deel.click();
  await expect(deel).toHaveAttribute('aria-expanded', 'true');
  await expect(timeline.getByText('Helped lead and maintain the HRIS team')).toBeVisible();

  const metrics = careerAnswer.getByRole('region', { name: 'Key metrics' });
  await expect(metrics.getByText('Reduction in loading time on critical pages')).toBeVisible();
  await expect(metrics.getByText('50%', { exact: true })).toBeVisible();

  await expect(careerAnswer.getByText('Sources')).toBeVisible();
  await expect(careerAnswer.getByText('Resume', { exact: true })).toHaveCount(1);

  const actions = careerAnswer.getByRole('group', { name: 'Answer actions' });
  await expect(actions.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'View Deel experience' })).toBeVisible();

  const followUps = careerAnswer.getByRole('list', { name: 'Ask a follow-up' });
  await followUps.getByRole('button', { name: 'What has he built at Deel?' }).click();

  await expect(page.getByText('You asked: What has he built at Deel?')).toBeVisible();
  await expect(answers(page)).toHaveCount(2);
  const deelAnswer = answers(page).nth(1);
  await expect(
    deelAnswer.getByText('Marcio worked at Deel from 2022 to 2026 as a Senior Frontend Engineer'),
  ).toBeVisible();
  await expect(
    deelAnswer.getByRole('region', { name: 'Key metrics' }).getByText('6s → 3s'),
  ).toBeVisible();
  await expect(careerAnswer.getByRole('list', { name: 'Ask a follow-up' })).toBeHidden();
});

test('a question the record does not document gets an honest answer instead of a guess', async ({
  page,
}) => {
  await composer(page).fill('Has he worked with Vue?');
  await composer(page).press('Enter');

  await expect(page.getByText('You asked: Has he worked with Vue?')).toBeVisible();
  const answer = answers(page).last();
  await expect(
    answer.getByText(
      "I don't have documented information about Marcio working with Vue in his roles, so I can't say how experienced he is with it.",
    ),
  ).toBeVisible();
  await expect(answer.getByText('Resume', { exact: true })).toBeVisible();
});

test('a failed answer offers to try again, and trying again answers the same question', async ({
  page,
}) => {
  await page.route('**/api/chat', (route) => route.fulfill({ status: 500 }), { times: 1 });
  await page.getByRole('button', { name: 'His career' }).click();

  const failure = page.getByRole('alert').filter({ hasText: "Couldn't load this answer" });
  await expect(failure).toBeVisible();
  await expect(failure).toContainText('Something failed on our side. Please try again.');

  await failure.getByRole('button', { name: 'Try again' }).click();

  await expect(failure).toBeHidden();
  await expect(
    answers(page).last().getByText('Marcio is a frontend engineer with over 10 years'),
  ).toBeVisible();
  await expect(page.getByText("You asked: Tell me about Marcio's career.")).toHaveCount(1);
});
