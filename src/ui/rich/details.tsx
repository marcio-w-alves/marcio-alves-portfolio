'use client';

import { useId, useState } from 'react';
import { InlineText } from '../format/inline';
import { cn } from '../cn';
import { Icon } from '../primitives';

interface DetailsProps {
  readonly summary: string;
  readonly text: string;
}

/** A follow-up explanation kept out of the way until the visitor asks for it. */
export function Details({ summary, text }: DetailsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="shadow-raised animate-block-enter rounded-md bg-surface">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        className="flex min-h-11.5 w-full cursor-pointer items-center justify-between gap-3 rounded-md bg-transparent px-3.5 py-2.5 text-left font-sans text-14 leading-label font-medium text-ink hover:bg-bg"
      >
        <span>{summary}</span>
        <Icon
          name="chevronDown"
          size="sm"
          className={cn(
            'text-ink-faint transition-[rotate] duration-medium ease-standard',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen ? (
        <div
          id={panelId}
          className="animate-reveal px-3.5 pb-3.5 text-14.5 leading-prose text-ink-muted"
        >
          {paragraphs(text).map((paragraph, index) => (
            <p key={index} className="text-pretty wrap-anywhere">
              <InlineText text={paragraph} />
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/;

// Blank lines separate paragraphs and every list item stands as one; any other
// line break is soft, as in Markdown.
function paragraphs(text: string): string[] {
  const result: string[] = [];
  let open: string[] = [];
  const close = () => {
    if (open.length > 0) result.push(open.join(' '));
    open = [];
  };
  for (const line of text.split('\n')) {
    if (LIST_ITEM.test(line)) {
      close();
      result.push(line.replace(LIST_ITEM, '').trim());
    } else if (line.trim() === '') {
      close();
    } else {
      open.push(line.trim());
    }
  }
  close();
  return result;
}
