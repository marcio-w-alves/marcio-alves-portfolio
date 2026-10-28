'use client';

import { useEffect, useState } from 'react';
import type { Feedback } from '@/core/conversation/messages';
import { cn } from '../cn';
import { Icon } from '../primitives';

/** A quiet text action under an answer. */
export const ACTION = cn(
  'inline-flex h-7.5 min-w-7.5 cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-transparent px-2 font-sans text-12.5 leading-none font-normal text-ink-muted',
  'transition-[background-color,color,scale] duration-fast ease-standard hover:not-disabled:bg-fill hover:not-disabled:text-ink active:not-disabled:scale-97 aria-pressed:bg-fill aria-pressed:text-ink',
  'disabled:cursor-not-allowed disabled:text-ink-faint',
  '@max-phone/ma:h-10 @max-phone/ma:min-w-10',
);

const CONFIRM_MS = 1800;

interface AnswerActionsProps {
  readonly feedback: Feedback | null;
  /** Resolves to whether the answer reached the clipboard. */
  readonly onCopy: () => Promise<boolean>;
  readonly onAskFollowUp: () => void;
  /** The role the answer is about, offered as a way into that experience. */
  readonly related: { readonly label: string; readonly onView: () => void } | null;
  /** While an answer is on its way, nothing that asks another question can be used. */
  readonly busy?: boolean;
  readonly onRate: (feedback: Feedback) => void;
}

export function AnswerActions({
  feedback,
  onCopy,
  onAskFollowUp,
  related,
  onRate,
  busy = false,
}: AnswerActionsProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, CONFIRM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  return (
    <div
      role="group"
      aria-label="Answer actions"
      className="-ml-2 flex flex-wrap items-center gap-0.5"
    >
      <button
        type="button"
        className={ACTION}
        onClick={() => {
          void onCopy().then(setCopied);
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} size="sm" />
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button type="button" className={ACTION} onClick={onAskFollowUp}>
        <Icon name="message" size="sm" />
        Ask follow-up
      </button>
      {related && (
        <button type="button" className={ACTION} disabled={busy} onClick={related.onView}>
          <Icon name="briefcase" size="sm" />
          {related.label}
        </button>
      )}
      <span aria-hidden="true" className="mx-1.5 h-3.5 w-px bg-border-strong" />
      <button
        type="button"
        className={ACTION}
        aria-label="Helpful"
        aria-pressed={feedback === 'up'}
        onClick={() => {
          onRate('up');
        }}
      >
        <Icon name="thumbsUp" size="sm" />
      </button>
      <button
        type="button"
        className={ACTION}
        aria-label="Not helpful"
        aria-pressed={feedback === 'down'}
        onClick={() => {
          onRate('down');
        }}
      >
        <Icon name="thumbsDown" size="sm" />
      </button>
      {feedback && (
        <span role="status" className="pl-1.5 text-12.5 text-ink-muted">
          Thanks for the feedback
        </span>
      )}
    </div>
  );
}
