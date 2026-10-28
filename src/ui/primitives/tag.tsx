import type { ReactNode } from 'react';
import { cn } from '../cn';

const TONES = {
  neutral: 'bg-surface text-ink-muted inset-shadow-ring',
  accent: 'bg-accent-bg text-accent',
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
        'inline-flex h-5 items-center gap-1 rounded-pill px-1.75 font-mono text-11 leading-none font-medium tracking-mono whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
