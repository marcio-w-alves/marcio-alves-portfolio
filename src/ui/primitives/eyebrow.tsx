import type { ReactNode } from 'react';
import { cn } from '../cn';

interface EyebrowProps {
  readonly children: ReactNode;
  /** A section label is often the heading of what follows; say so when it is. */
  readonly as?: 'p' | 'span' | 'h2' | 'h3';
  readonly id?: string;
  readonly className?: string;
}

export function Eyebrow({ children, as: Element = 'p', id, className }: EyebrowProps) {
  return (
    <Element
      id={id}
      className={cn(
        'm-0 font-mono text-11.5 leading-label font-medium tracking-label text-ink-muted uppercase',
        className,
      )}
    >
      {children}
    </Element>
  );
}
