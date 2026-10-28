'use client';

import { useEffect, useState } from 'react';
import type { Feedback } from '@/core/conversation/messages';
import { cn } from '../cn';
import { Icon } from '../primitives';

/** A quiet text action under an answer. */
export const ACTION = cn(
  'inline-flex h-7.5 min-w-7.5 cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-transparent px-2 font-sans text-12.5 leading-none text-ink-muted',
  'hover:bg-hover transition-colors duration-fast ease-standard hover:text-ink aria-pressed:text-accent',
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
  readonly onRate: (feedback: Feedback) => void;
}

export function AnswerActions({
  feedback,
  onCopy,
  onAskFollowUp,
  related,
  onRate,
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
        <button type="button" className={ACTION} onClick={related.onView}>
          <Icon name="briefcase" size="sm" />
          {related.label}
        </button>
      )}
      <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-border" />
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
