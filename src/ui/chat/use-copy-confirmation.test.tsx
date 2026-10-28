import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { AnswerActions } from './answer-actions';
import { CodeBlock } from './code-block';
import { copyText } from './copy-text';

const COPIERS = [
  {
    name: 'an answer',
    label: 'Copy',
    copied: 'He led the HRIS team.',
    render: () =>
      renderWithMessages(
        <AnswerActions
          feedback={null}
          onCopy={() => copyText('He led the HRIS team.')}
          onAskFollowUp={vi.fn()}
          related={null}
          onRate={vi.fn()}
        />,
      ),
  },
  {
    name: 'a code block',
    label: 'Copy code',
    copied: 'const a = 1;',
    render: () => renderWithMessages(<CodeBlock language="ts" code="const a = 1;" />),
  },
];

// The clipboard is the browser's; jsdom has none. User-event brings one, but
// its async wrapper waits on a timer the fake clock never fires.
let clipboardText = '';
const writeText = vi.fn((text: string) => {
  clipboardText = text;
  return Promise.resolve();
});

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await Promise.resolve();
  });
}

function elapse(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  clipboardText = '';
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each(COPIERS)('copying $name', (copier) => {
  it('confirms the copy, announces it, then reverts', async () => {
    copier.render();

    await click(copier.label);

    expect(clipboardText).toBe(copier.copied);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Copied');

    elapse(1800);

    expect(screen.getByRole('button', { name: copier.label })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('restarts the confirmation when copied again', async () => {
    copier.render();

    await click(copier.label);
    elapse(1000);
    await click('Copied');
    elapse(900);

    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    elapse(1000);

    expect(screen.getByRole('button', { name: copier.label })).toBeInTheDocument();
  });

  it('confirms nothing when the clipboard refuses the text', async () => {
    writeText.mockRejectedValueOnce(new Error('Denied'));
    copier.render();

    await click(copier.label);

    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
