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
import { formatNodes } from '../i18n/format-nodes';
import { useMessages } from '../i18n/i18n-provider';
import { Icon } from '../primitives';

/**
 * - `idle`: ready for a question.
 * - `streaming`: an answer is arriving; the send control becomes "Stop".
 * - `waiting`: an answer is arriving elsewhere; the draft can be written, not sent.
 * - `unavailable`: the assistant cannot take questions, so the input is disabled.
 */
export type ComposerStatus = 'idle' | 'streaming' | 'waiting' | 'unavailable';

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
  /** Draws the focused look without taking focus, to show the state beside others. */
  readonly looksFocused?: boolean | undefined;
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
  looksFocused = false,
}: ChatComposerProps) {
  const { composer } = useMessages();
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
    <form className="flex w-full flex-col gap-3" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={id}>
        {composer.label}
      </label>
      <div
        className={cn(
          'flex flex-col rounded-xl bg-surface shadow-float',
          'transition-shadow duration-medium ease-standard focus-within:shadow-composer-focus',
          looksFocused && 'shadow-composer-focus',
          isUnavailable && 'bg-ice shadow-ring',
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
            'block max-h-50 min-h-15 w-full resize-none overflow-y-auto border-0 bg-transparent px-5 pt-4.5 pb-1',
            'field-sizing-content font-sans text-15.5 leading-body font-normal text-ink outline-0',
            'placeholder:text-ink-muted disabled:cursor-not-allowed',
            variant === 'dock' && 'min-h-13 pt-3.75',
          )}
        />
        <div className="flex items-center justify-between gap-3 pt-1.5 pr-2.5 pb-2.5 pl-5 @max-phone/ma:justify-end">
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
          className="m-0 flex flex-wrap items-center justify-center gap-y-1 text-center text-12 leading-label text-ink-muted"
        >
          <span>{helper}</span>
        </p>
      ) : null}
    </form>
  );
}

function KeyboardHint() {
  const { composer } = useMessages();
  return (
    <span aria-hidden="true" className="text-12 text-ink-muted @max-phone/ma:hidden">
      {formatNodes(composer.keyboardHint, {
        enter: <Key>{composer.enterKey}</Key>,
        shift: <Key>{composer.shiftKey}</Key>,
      })}
    </span>
  );
}

function Key({ children }: { readonly children: string }) {
  return (
    <kbd className="rounded-kbd bg-fill px-1.5 py-0.75 font-sans text-11 leading-none font-medium text-ink">
      {children}
    </kbd>
  );
}

const SEND_CONTROL = cn(
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-accent p-0 text-on-accent',
  'transition-[background-color,scale] duration-fast ease-standard hover:not-disabled:bg-accent-hover active:not-disabled:scale-93',
  '@max-phone/ma:size-10.5',
);

function SendButton({ disabled }: { readonly disabled: boolean }) {
  const { composer } = useMessages();
  return (
    <button
      type="submit"
      aria-label={composer.send}
      disabled={disabled}
      className={cn(
        SEND_CONTROL,
        'disabled:cursor-not-allowed disabled:bg-fill disabled:text-ink-faint',
      )}
    >
      <Icon name="arrowUp" />
    </button>
  );
}

function StopButton({ onStop }: { readonly onStop: () => void }) {
  const { composer } = useMessages();
  return (
    <button type="button" aria-label={composer.stop} onClick={onStop} className={SEND_CONTROL}>
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
