import { createRef, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MAX_QUESTION_LENGTH } from '@/core/chat/request';
import { profile } from '@/profile';
import { createSiteContent } from '@/site/site-content';
import { ChatComposer, ComposerDock, JumpToLatest, type ChatComposerHandle } from '.';

const { knowledge } = createSiteContent(profile.knowledge, profile.copy.en.answers);

const { welcome } = knowledge;

type HarnessProps = Partial<Parameters<typeof ChatComposer>[0]> & {
  readonly initialValue?: string;
};

// The composer is controlled; the harness is the parent that owns the draft.
function Harness({ initialValue = '', onChange, ...props }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <ChatComposer
      variant="hero"
      status="idle"
      placeholder={welcome.placeholder}
      maxLength={MAX_QUESTION_LENGTH}
      onSubmit={vi.fn()}
      onStop={vi.fn()}
      {...props}
      value={value}
      onChange={(text) => {
        setValue(text);
        onChange?.(text);
      }}
    />
  );
}

const input = () => screen.getByRole('textbox', { name: 'Ask the portfolio assistant a question' });
const sendButton = () => screen.getByRole('button', { name: 'Send question' });

describe('ChatComposer', () => {
  it('reports every keystroke to its parent', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(input(), 'Hi');

    expect(onChange).toHaveBeenLastCalledWith('Hi');
    expect(input()).toHaveValue('Hi');
  });

  it('sends the question on Enter', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(input(), 'What did he build at Deel?{Enter}');

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(input()).toHaveValue('What did he build at Deel?');
  });

  it('breaks the line on Shift+Enter instead of sending', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(input(), 'First line{Shift>}{Enter}{/Shift}second line');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input()).toHaveValue('First line\nsecond line');
  });

  it('sends with the send button', async () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="Which projects used Next.js?" onSubmit={onSubmit} />);

    await userEvent.click(sendButton());

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('cannot send a blank question', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    expect(sendButton()).toBeDisabled();

    await userEvent.type(input(), '   {Enter}');
    await userEvent.click(sendButton());

    expect(sendButton()).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers Stop instead of Send while an answer streams', async () => {
    const onStop = vi.fn();
    const onSubmit = vi.fn();
    render(<Harness status="streaming" initialValue="Next" onStop={onStop} onSubmit={onSubmit} />);
    expect(screen.queryByRole('button', { name: 'Send question' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    await userEvent.type(input(), '{Enter}');

    expect(onStop).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('takes no questions while the assistant is unavailable', () => {
    render(<Harness status="unavailable" initialValue="Hello" />);

    expect(input()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
  });

  it('stops at the longest question the API accepts', async () => {
    render(<Harness />);
    await userEvent.click(input());

    await userEvent.paste('a'.repeat(MAX_QUESTION_LENGTH + 50));

    expect(input()).toHaveValue('a'.repeat(MAX_QUESTION_LENGTH));
  });

  it('describes the input with its helper line', () => {
    render(<Harness helper={welcome.helper} />);

    expect(input()).toHaveAccessibleDescription(welcome.helper);
  });

  it('lets the parent put the caret at the end of the draft', () => {
    const ref = createRef<ChatComposerHandle>();
    render(<Harness ref={ref} initialValue="Tell me more" />);
    expect(input()).not.toHaveFocus();

    act(() => ref.current?.focus());

    expect(input()).toHaveFocus();
    expect(input()).toHaveProperty('selectionStart', 'Tell me more'.length);
  });

  it('leaves focus alone when the input is disabled', () => {
    const ref = createRef<ChatComposerHandle>();
    render(<Harness ref={ref} status="unavailable" />);

    act(() => ref.current?.focus());

    expect(input()).not.toHaveFocus();
  });
});

describe('JumpToLatest', () => {
  it('runs its action from inside the dock', async () => {
    const onClick = vi.fn();
    render(
      <ComposerDock jumpToLatest={<JumpToLatest onClick={onClick} />}>
        <Harness variant="dock" />
      </ComposerDock>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(input()).toBeInTheDocument();
  });
});
