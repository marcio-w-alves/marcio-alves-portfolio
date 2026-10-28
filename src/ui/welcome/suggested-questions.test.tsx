import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { suggestions } from '@/core/assistant/topics';
import { SuggestedQuestions } from './suggested-questions';

const questions = suggestions('overview', 0, 4);

describe('SuggestedQuestions', () => {
  it('lists every question as a button named by the question, under its title', () => {
    render(
      <SuggestedQuestions title="Suggested questions" questions={questions} onPick={vi.fn()} />,
    );

    const list = screen.getByRole('list', { name: 'Suggested questions' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(questions);
  });

  it('hands the picked question to the parent', async () => {
    const onPick = vi.fn();
    render(
      <SuggestedQuestions title="Suggested questions" questions={questions} onPick={onPick} />,
    );

    await userEvent.click(screen.getByRole('button', { name: "Tell me about Marcio's career." }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith("Tell me about Marcio's career.");
  });

  it('asks the parent for other questions when "More questions" is pressed', async () => {
    const onPick = vi.fn();
    const onShuffle = vi.fn();
    render(
      <SuggestedQuestions
        title="Suggested questions"
        questions={questions}
        onPick={onPick}
        onShuffle={onShuffle}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'More questions' }));

    expect(onShuffle).toHaveBeenCalledOnce();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('offers no "More questions" control when the parent cannot shuffle', () => {
    render(
      <SuggestedQuestions title="Suggested questions" questions={questions} onPick={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: 'More questions' })).not.toBeInTheDocument();
  });

  it('works the same as chips', async () => {
    const onPick = vi.fn();
    render(
      <SuggestedQuestions
        variant="chips"
        title="Follow-up questions"
        questions={['What did he do at Roots?', 'Has he led engineering teams?']}
        onPick={onPick}
      />,
    );

    const list = screen.getByRole('list', { name: 'Follow-up questions' });
    await userEvent.click(
      within(list).getByRole('button', { name: 'Has he led engineering teams?' }),
    );

    expect(onPick).toHaveBeenCalledExactlyOnceWith('Has he led engineering teams?');
  });

  it('keeps two lists on one page labelled by their own titles', () => {
    render(
      <>
        <SuggestedQuestions title="Suggested questions" questions={questions} onPick={vi.fn()} />
        <SuggestedQuestions
          variant="chips"
          title="Follow-up questions"
          questions={['Where did he study?']}
          onPick={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('list', { name: 'Suggested questions' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Follow-up questions' })).toBeInTheDocument();
  });
});
