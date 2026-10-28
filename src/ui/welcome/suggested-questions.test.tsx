import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { createSiteContent } from '@/site/site-content';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { SuggestedQuestions } from './suggested-questions';

const { topicCatalog } = createSiteContent(fixtureKnowledge, fixtureAnswers);

const welcomeChoices = topicCatalog
  .suggestedQuestions('overview', 0, 4)
  .map(({ question, short }) => ({
    question,
    label: short,
  }));

describe('SuggestedQuestions', () => {
  it('shows each suggestion by its short label, under its title', () => {
    renderWithMessages(
      <SuggestedQuestions
        title="Suggested questions"
        questions={welcomeChoices}
        onPick={vi.fn()}
      />,
    );

    const list = screen.getByRole('list', { name: 'Suggested questions' });
    const chips = within(list).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Her career', 'Payroll', 'Skills']);
  });

  it('asks the full question when its short label is picked', async () => {
    const onPick = vi.fn();
    renderWithMessages(
      <SuggestedQuestions title="Suggested questions" questions={welcomeChoices} onPick={onPick} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Payroll' }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith('Did she lead the payroll team?');
  });

  it('shows the question itself where no label is given', async () => {
    const onPick = vi.fn();
    renderWithMessages(
      <SuggestedQuestions
        title="Ask a follow-up"
        questions={[
          { question: 'What did she do at Globex?' },
          { question: 'Has she led platform teams?' },
        ]}
        onPick={onPick}
      />,
    );

    const list = screen.getByRole('list', { name: 'Ask a follow-up' });
    await userEvent.click(
      within(list).getByRole('button', { name: 'Has she led platform teams?' }),
    );

    expect(onPick).toHaveBeenCalledExactlyOnceWith('Has she led platform teams?');
  });

  it('still names the list for screen readers when the title is hidden', () => {
    renderWithMessages(
      <SuggestedQuestions
        title="Suggested questions"
        hideTitle
        align="center"
        questions={welcomeChoices}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByRole('list', { name: 'Suggested questions' })).toBeInTheDocument();
  });

  it('keeps two lists on one page labelled by their own titles', () => {
    renderWithMessages(
      <>
        <SuggestedQuestions
          title="Suggested questions"
          questions={welcomeChoices}
          onPick={vi.fn()}
        />
        <SuggestedQuestions
          title="Ask a follow-up"
          questions={[{ question: 'Where did she study?' }]}
          onPick={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('list', { name: 'Suggested questions' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Ask a follow-up' })).toBeInTheDocument();
  });
});
