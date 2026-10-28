import type { ReactNode } from 'react';
import { cn } from '../cn';

const TONES = {
  neutral: 'bg-fill text-ink-muted',
  accent: 'bg-accent-soft text-ink',
} as const;

interface TagProps {
  readonly children: ReactNode;
  readonly tone?: keyof typeof TONES;
  readonly className?: string;
}

export function Tag({ children, tone = 'neutral', className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1 rounded-pill px-2.25 font-sans text-11.5 leading-none font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
