'use client';

import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type Ref,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { cn } from '../cn';
import { Icon } from '../primitives';

/**
 * - `idle`: ready for a question.
 * - `streaming`: an answer is arriving; the send control becomes "Stop".
 * - `unavailable`: the assistant cannot take questions, so the input is disabled.
 */
export type ComposerStatus = 'idle' | 'streaming' | 'unavailable';

export type ComposerVariant = 'hero' | 'dock';

/** What the parent can do to the composer: move the caret into it, at the end of the draft. */
export interface ChatComposerHandle {
  focus(): void;
}

interface ChatComposerProps {
  /** The draft. The parent owns it, so it survives a failed send. */
  readonly value: string;
  readonly onChange: (text: string) => void;
  /** Called only for a non-blank draft while idle; the parent reads `value` itself. */
  readonly onSubmit: () => void;
  readonly onStop: () => void;
  readonly status: ComposerStatus;
  readonly variant: ComposerVariant;
  readonly placeholder: string;
  /** The longest question the API accepts; typing and pasting stop there. */
  readonly maxLength: number;
  readonly helper?: string | undefined;
  readonly inputId?: string | undefined;
  /** Call `ref.current.focus()` to put the visitor in the input, e.g. after "Ask a follow-up". */
  readonly ref?: Ref<ChatComposerHandle> | undefined;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  status,
  variant,
  placeholder,
  maxLength,
  helper,
  inputId,
  ref,
}: ChatComposerProps) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  const helperId = `${id}-helper`;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isUnavailable = status === 'unavailable';
  const canSend = status === 'idle' && value.trim() !== '';

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        focusAtEnd(inputRef.current);
      },
    }),
    [],
  );
  useGrowWithContent(inputRef, value);

  function submitIfReady() {
    if (canSend) onSubmit();
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    submitIfReady();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const isComposing = event.nativeEvent.isComposing;
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || isComposing) return;
    event.preventDefault();
    submitIfReady();
  }

  return (
    <form className="flex w-full flex-col gap-2.5" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={id}>
        Ask the portfolio assistant a question
      </label>
      <div
        className={cn(
          'flex flex-col rounded-xl border border-border-strong bg-surface shadow-composer',
          'transition-[border-color,box-shadow] duration-medium ease-standard',
          'focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/22',
          isUnavailable && 'bg-sidebar shadow-none',
        )}
      >
        <textarea
          ref={inputRef}
          id={id}
          rows={1}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          disabled={isUnavailable}
          aria-describedby={helper ? helperId : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'block max-h-50 min-h-15 w-full resize-none overflow-y-auto border-0 bg-transparent px-4.5 pt-4 pb-1',
            'field-sizing-content font-sans text-16 leading-body font-normal text-ink outline-0',
            'placeholder:text-ink-muted disabled:cursor-not-allowed',
            variant === 'dock' && 'min-h-13 pt-3.5',
          )}
        />
        <div className="flex items-center justify-between gap-3 pt-1.5 pr-2 pb-2 pl-4.5 @max-phone/ma:justify-end">
          <KeyboardHint />
          {status === 'streaming' ? (
            <StopButton onStop={onStop} />
          ) : (
            <SendButton disabled={!canSend} />
          )}
        </div>
      </div>
      {helper ? (
        <p
          id={helperId}
          className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-center text-12.5 leading-label text-ink-muted"
        >
          <span>{helper}</span>
        </p>
      ) : null}
    </form>
  );
}

function KeyboardHint() {
  return (
    <span
      aria-hidden="true"
      className="font-mono text-12 leading-label font-normal text-ink-muted @max-phone/ma:hidden"
    >
      <Key>Enter</Key> to send · <Key>Shift</Key> + <Key>Enter</Key> for a new line
    </span>
  );
}

function Key({ children }: { readonly children: string }) {
  return <kbd className="rounded-kbd bg-bg px-1.25 py-px inset-shadow-ring">{children}</kbd>;
}

const SEND_CONTROL = cn(
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-control border-0 p-0 text-white',
  'transition-[background-color,scale] duration-fast ease-standard active:not-disabled:scale-94',
  '@max-phone/ma:size-10',
);

function SendButton({ disabled }: { readonly disabled: boolean }) {
  return (
    <button
      type="submit"
      aria-label="Send question"
      disabled={disabled}
      className={cn(
        SEND_CONTROL,
        'bg-accent hover:not-disabled:bg-accent-hover',
        'disabled:cursor-not-allowed disabled:bg-hover disabled:text-ink-faint',
      )}
    >
      <Icon name="arrowUp" />
    </button>
  );
}

function StopButton({ onStop }: { readonly onStop: () => void }) {
  return (
    <button
      type="button"
      aria-label="Stop generating"
      onClick={onStop}
      className={cn(SEND_CONTROL, 'bg-ink hover:bg-black')}
    >
      <Icon name="stop" size="sm" className="fill-current" />
    </button>
  );
}

function focusAtEnd(input: HTMLTextAreaElement | null) {
  if (!input || input.disabled) return;
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

// `field-sizing: content` grows the input natively; where a browser lacks it,
// measure the content instead. The CSS max-height still caps the result.
function useGrowWithContent(inputRef: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || CSS.supports('field-sizing', 'content')) return;
    input.style.height = 'auto';
    input.style.height = `${String(input.scrollHeight)}px`;
  }, [inputRef, value]);
}
