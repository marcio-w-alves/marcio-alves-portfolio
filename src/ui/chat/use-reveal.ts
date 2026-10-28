'use client';

import { useEffect, useState } from 'react';
import type { AssistantMessage, Conversation } from '@/core/conversation/messages';
import { nextStep, revealLength, revealParts } from './reveal';

/**
 * Even an answer that arrives at once stays in "thinking" this long, so the
 * visitor sees the assistant start before the text runs.
 */
export const MIN_THINKING_MS = 450;

const FRAME_MS = 1000 / 60;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Progress {
  readonly id: string;
  readonly shown: number;
  /** When the answer was first seen, on the animation clock. */
  readonly since: number;
  /** The last frame, so waiting out the thinking time still renders each frame. */
  readonly frame: number;
}

/**
 * Types out the newest answer asked on this page as it arrives. Answers that
 * were already there when the page opened — a conversation coming back after
 * navigating, a state the page is shown in — appear whole, as does
 * everything for a visitor who prefers reduced motion.
 */
export function useReveal(conversation: Conversation) {
  const [opened] = useState(() => new Set(conversation.messages.map((message) => message.id)));
  const [progress, setProgress] = useState<Progress | null>(null);

  const live = conversation.messages.findLast(
    (message): message is AssistantMessage =>
      message.role === 'assistant' && message.kind === 'answer' && !opened.has(message.id),
  );
  const liveId = live?.id;
  const total = live ? revealLength(live.parts) : 0;
  // A stopped or failed answer shows what it has at once.
  const settled = live?.status === 'stopped' || live?.status === 'error';
  const shown = progress && progress.id === liveId ? progress.shown : 0;
  const typing = live !== undefined && !settled && (shown < total || live.status !== 'done');

  useEffect(() => {
    if (liveId === undefined || settled || (progress?.id === liveId && shown >= total)) return;
    // A timer, not animation frames: frames stop in a background tab, and the
    // answer must still be there, whole, when the visitor comes back.
    const timer = setTimeout(() => {
      const now = performance.now();
      setProgress((previous) => {
        const base =
          previous?.id === liveId ? previous : { id: liveId, shown: 0, since: now, frame: now };
        if (prefersReducedMotion()) return { ...base, shown: total, frame: now };
        if (now - base.since < MIN_THINKING_MS) return { ...base, frame: now };
        // Paced by time, so a throttled tab catches up instead of falling behind.
        const frames = Math.max(1, Math.round((now - base.frame) / FRAME_MS));
        let shownNow = base.shown;
        for (let step = 0; step < frames && shownNow < total; step += 1) {
          shownNow += nextStep(total - shownNow);
        }
        return { ...base, shown: shownNow, frame: now };
      });
    }, FRAME_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [liveId, settled, progress, shown, total]);

  /** The message as it should look right now. */
  function view(message: AssistantMessage): AssistantMessage {
    if (!typing || message.id !== liveId) return message;
    if (shown === 0) return { ...message, status: 'pending', parts: [] };
    return { ...message, status: 'streaming', parts: revealParts(message.parts, shown) };
  }

  /** Shows the rest at once, as stopping an answer that has fully arrived does. */
  function finish() {
    if (progress && progress.id === liveId) setProgress({ ...progress, shown: total });
  }

  return { view, typing, shown, finish };
}
