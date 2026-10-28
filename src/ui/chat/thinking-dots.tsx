import type { CSSProperties } from 'react';

const DELAYS = ['0ms', '150ms', '300ms'];

export function ThinkingDots() {
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      {DELAYS.map((delay) => (
        <span
          key={delay}
          style={{ '--dot-delay': delay } as CSSProperties}
          className="size-1.25 animate-pulse-dot rounded-full bg-accent"
        />
      ))}
    </span>
  );
}
