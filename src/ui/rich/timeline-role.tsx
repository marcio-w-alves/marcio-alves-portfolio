'use client';

import { useId, useState, type ReactNode } from 'react';
import type { RoleView } from '@/core/assistant/components';
import { cn } from '../cn';
import { Icon, Tag } from '../primitives';

interface TimelineRoleProps {
  readonly role: RoleView;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly initiallyOpen: boolean;
  /** The role's sections, shown while it is open. */
  readonly children: ReactNode;
}

export function TimelineRole({
  role,
  isFirst,
  isLast,
  initiallyOpen,
  children,
}: TimelineRoleProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const panelId = useId();

  return (
    <li className="grid grid-cols-timeline gap-x-3 @max-timeline-narrow/timeline:grid-cols-timeline-narrow">
      <p className="pt-3.25 font-mono text-12 leading-label font-medium whitespace-nowrap text-ink-muted tabular-nums @max-timeline-narrow/timeline:col-start-2 @max-timeline-narrow/timeline:row-start-1 @max-timeline-narrow/timeline:pt-2.5">
        {role.period}
      </p>
      <Rail isFirst={isFirst} isLast={isLast} isCurrent={role.current} />
      <div className="min-w-0 pt-1 pb-4 @max-timeline-narrow/timeline:col-start-2 @max-timeline-narrow/timeline:row-start-2 @max-timeline-narrow/timeline:pt-0">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => {
            setIsOpen((open) => !open);
          }}
          className="-mx-2 flex w-bleed cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 rounded-sm bg-transparent px-2 py-1.5 text-left transition-[background-color] duration-fast ease-standard hover:bg-hover @max-phone/ma:min-h-11"
        >
          <span className="text-15 font-semibold tracking-name">{role.company}</span>
          <span className="text-14 text-ink-muted">{role.role}</span>
          {role.current ? <Tag tone="accent">Current</Tag> : null}
          {role.concurrent && !role.current ? <Tag>Concurrent</Tag> : null}
          <Icon
            name="chevronDown"
            size="sm"
            className={cn(
              'ml-auto text-ink-faint transition-[rotate] duration-medium ease-standard',
              isOpen && 'rotate-180',
            )}
          />
        </button>
        <p className="mt-0.5 text-14 leading-body text-ink-muted">{role.summary}</p>
        {isOpen ? (
          <div
            id={panelId}
            className="mt-3 flex animate-rise flex-col gap-4 rounded-md bg-surface p-4 shadow-raised"
          >
            {children}
          </div>
        ) : null}
      </div>
    </li>
  );
}

interface RailProps {
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isCurrent: boolean;
}

// The line starts at the first dot and stops at the last one.
function Rail({ isFirst, isLast, isCurrent }: RailProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex justify-center before:absolute before:top-0 before:bottom-0 before:left-1/2 before:w-px before:bg-border-strong',
        '@max-timeline-narrow/timeline:col-start-1 @max-timeline-narrow/timeline:row-span-2 @max-timeline-narrow/timeline:row-start-1',
        isFirst && 'before:top-4.5',
        isLast && 'before:bottom-auto before:h-4.5',
      )}
    >
      <span
        className={cn(
          'relative mt-3.5 size-2.25 rounded-full @max-timeline-narrow/timeline:mt-3.25',
          isCurrent ? 'bg-accent shadow-dot-current' : 'bg-bg inset-shadow-dot',
        )}
      />
    </div>
  );
}
