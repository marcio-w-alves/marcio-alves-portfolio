'use client';

import { useEffect, useState } from 'react';
import { useMessages } from '../i18n/i18n-provider';
import { ThinkingDots } from './thinking-dots';

const PHASE_MS = 1600;

/**
 * What the assistant is doing while an answer has not started, phrased the way
 * a person would say it. The first phase is the design's own line; the rest
 * rotate so a slower answer visibly keeps working instead of looking stuck.
 */
export function ThinkingStatus() {
  const phases = useMessages().conversation.thinking;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((current) => (current + 1) % phases.length);
    }, PHASE_MS);
    return () => {
      clearInterval(timer);
    };
  }, [phases.length]);

  return (
    <p className="m-0 flex min-h-7 items-center gap-2.5 text-14 text-ink-muted">
      <ThinkingDots />
      <span
        key={phase}
        className="relative animate-reveal overflow-hidden after:absolute after:inset-0 after:animate-shimmer after:bg-linear-to-r after:from-transparent after:via-bg/80 after:to-transparent after:content-['']"
      >
        {phases[phase]}…
      </span>
    </p>
  );
}
