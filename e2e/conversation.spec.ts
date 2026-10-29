import { expect, test } from '@playwright/test';
import { answers, composer, holdNextAnswer, sendButton, stopButton } from './support/assistant';
import {
  firstResponsibility,
  firstSuggestion,
  firstThinkingPhase,
  metric,
  record,
  roleByCompany,
  sourceLabelPattern,
  labels,
  templatePattern,
  ui,
  youAsked,
} from './support/profile';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('a suggested question streams in as a rich answer, and a follow-up continues the conversation', async ({
  page,
}) => {
  const suggestion = firstSuggestion();
  const releaseAnswer = await holdNextAnswer(page);
  await page.getByRole('button', { name: suggestion.label }).click();

  await expect(page.getByText(youAsked(suggestion.question))).toBeVisible();
  await expect(page.getByText(firstThinkingPhase())).toBeVisible();
  await expect(stopButton(page)).toBeVisible();

  releaseAnswer();
  const firstAnswer = answers(page).first();
  const actions = firstAnswer.getByRole('group', { name: ui.actions.group });
  await expect(actions).toBeVisible();
  await expect(stopButton(page)).toBeHidden();
  await expect(sendButton(page)).toBeVisible();
  await expect(actions.getByRole('button', { name: ui.actions.copy })).toBeVisible();

  // The answer is about one role, offered as a way into it: the rest of the journey follows it.
  const viewRole = actions.getByRole('button', { name: templatePattern(ui.actions.viewRole) });
  const viewLabel = await viewRole.innerText();
  const company = templatePattern(ui.actions.viewRole).exec(viewLabel)?.[1] ?? '';
  const role = roleByCompany(company);

  const timeline = firstAnswer.getByRole('region', { name: labels.cards.timeline });
  const roleToggle = timeline.getByRole('button', { name: `${role.company} ${role.role}` });
  await expect(roleToggle).toHaveAttribute('aria-expanded', 'false');
  await roleToggle.click();
  await expect(roleToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(timeline.getByText(firstResponsibility(company))).toBeVisible();

  const shownMetrics = await firstAnswer
    .getByRole('region', { name: labels.cards.metrics })
    .getByRole('listitem')
    .allInnerTexts();
  expect(shownMetrics.length).toBeGreaterThan(0);
  for (const shown of shownMetrics) {
    const documented = Object.values(record.metrics).some(
      ({ value, label }) => shown.includes(value) && shown.includes(label),
    );
    expect(documented, shown).toBe(true);
  }

  await expect(firstAnswer.getByText(ui.conversation.sources)).toBeVisible();
  await expect(
    firstAnswer.getByText(record.sourceLabels[role.source] ?? '', { exact: true }),
  ).toHaveCount(1);

  const followUps = firstAnswer.getByRole('list', { name: ui.conversation.followUps });
  const aboutTheRole = followUps.getByRole('button', { name: company });
  const followUp = await aboutTheRole.innerText();
  await aboutTheRole.click();

  await expect(page.getByText(youAsked(followUp))).toBeVisible();
  await expect(answers(page)).toHaveCount(2);
  const roleAnswer = answers(page).nth(1);
  const roleMetrics = roleAnswer.getByRole('region', { name: labels.cards.metrics });
  for (const id of role.metrics) {
    await expect(roleMetrics.getByText(metric(id).value, { exact: true })).toBeVisible();
  }
  await expect(roleAnswer.getByText(firstResponsibility(company))).toBeVisible();
  await expect(firstAnswer.getByRole('list', { name: ui.conversation.followUps })).toBeHidden();
});

test('a question the record does not document gets an honest answer instead of a guess', async ({
  page,
}) => {
  const question = 'Has he worked with Vue?';
  await composer(page).fill(question);
  await composer(page).press('Enter');

  await expect(page.getByText(youAsked(question))).toBeVisible();
  const answer = answers(page).last();
  await expect(answer.getByRole('group', { name: ui.actions.group })).toBeVisible();
  await expect(answer).toContainText('Vue');
  // It answers from the record, citing it, rather than from what such a profile usually holds.
  await expect(answer.getByText(ui.conversation.sources)).toBeVisible();
  await expect(answer.getByText(sourceLabelPattern()).first()).toBeVisible();
});

test('a failed answer offers to try again, and trying again answers the same question', async ({
  page,
}) => {
  const suggestion = firstSuggestion();
  await page.route('**/api/chat', (route) => route.fulfill({ status: 500 }), { times: 1 });
  await page.getByRole('button', { name: suggestion.label }).click();

  const failure = page.getByRole('alert').filter({ hasText: ui.failure.title });
  await expect(failure).toBeVisible();
  await expect(failure).toContainText(ui.errors.internal);

  await failure.getByRole('button', { name: ui.failure.retry }).click();

  await expect(failure).toBeHidden();
  await expect(answers(page).last().getByRole('group', { name: ui.actions.group })).toBeVisible();
  await expect(page.getByText(youAsked(suggestion.question))).toHaveCount(1);
});
