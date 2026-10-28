import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThinkingStatus } from './thinking-status';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('what the assistant says while it thinks', () => {
  it("starts on the design's line, naming the owner, then moves on so a slow answer never looks stuck", () => {
    render(<ThinkingStatus ownerFirstName="Ada" />);
    expect(screen.getByText("Reading Ada's documented experience…")).toBeInTheDocument();

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
