import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { ThinkingStatus } from './thinking-status';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('what the assistant says while it thinks', () => {
  it("starts on the design's line, naming the profile's person, then moves on so a slow answer never looks stuck", () => {
    renderWithMessages(<ThinkingStatus />);
    expect(screen.getByText("Reading Ada's documented experience…")).toBeInTheDocument();
    expect(screen.queryByText(/\{firstName\}/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByText('Thinking…')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByText('Checking the sources…')).toBeInTheDocument();
  });
});
