import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { topics } from '@/core/assistant/topics';
import { TopicChips } from './topic-chips';

describe('TopicChips', () => {
  it('offers every topic by its label', () => {
    render(<TopicChips topics={topics} onPick={vi.fn()} />);

    const list = screen.getByRole('list', { name: 'Topics' });
    const labels = within(list)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual(topics.map((topic) => topic.label));
  });

  it('hands the picked topic id to the parent, not its label', async () => {
    const onPick = vi.fn();
    render(<TopicChips topics={topics} onPick={onPick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Engineering Philosophy' }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith('philosophy');
  });
});
