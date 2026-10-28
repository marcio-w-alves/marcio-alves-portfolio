import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { suggestedQuestions } from '@/core/assistant/topics';
import { SuggestedQuestions } from './suggested-questions';

const welcomeChoices = suggestedQuestions('overview', 0, 4).map(({ question, short }) => ({
  question,
  label: short,
}));

describe('SuggestedQuestions', () => {
  it('shows each suggestion by its short label, under its title', () => {
    render(
      <SuggestedQuestions
        title="Suggested questions"
        questions={welcomeChoices}
        onPick={vi.fn()}
      />,
    );

    const list = screen.getByRole('list', { name: 'Suggested questions' });
    const chips = within(list).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'His career',
      'Why Staff-level',
      'Work at Deel',
      'React & TypeScript',
    ]);
  });

  it('asks the full question when its short label is picked', async () => {
    const onPick = vi.fn();
    render(
      <SuggestedQuestions title="Suggested questions" questions={welcomeChoices} onPick={onPick} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Work at Deel' }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith('What has he built at Deel?');
  });

  it('shows the question itself where no label is given', async () => {
    const onPick = vi.fn();
    render(
      <SuggestedQuestions
        title="Ask a follow-up"
        questions={[
          { question: 'What did he do at Roots?' },
          { question: 'Has he led engineering teams?' },
        ]}
        onPick={onPick}
      />,
    );

    const list = screen.getByRole('list', { name: 'Ask a follow-up' });
    await userEvent.click(
      within(list).getByRole('button', { name: 'Has he led engineering teams?' }),
    );

    expect(onPick).toHaveBeenCalledExactlyOnceWith('Has he led engineering teams?');
  });

  it('still names the list for screen readers when the title is hidden', () => {
    render(
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
    render(
      <>
        <SuggestedQuestions
          title="Suggested questions"
          questions={welcomeChoices}
          onPick={vi.fn()}
        />
        <SuggestedQuestions
          title="Ask a follow-up"
          questions={[{ question: 'Where did he study?' }]}
          onPick={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('list', { name: 'Suggested questions' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Ask a follow-up' })).toBeInTheDocument();
  });
});
