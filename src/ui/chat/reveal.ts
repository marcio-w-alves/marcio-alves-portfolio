import type { MessagePart } from '@/core/conversation/messages';

/**
 * Answers are shown as if typed: text appears a few characters at a time and
 * a rich block appears once the text before it is out. These functions decide
 * how much is out; the hook in `use-reveal.ts` advances it frame by frame.
 *
 * A rich block counts as one character, so it shows up the moment the text
 * before it has been typed.
 */

export function revealLength(parts: readonly MessagePart[]): number {
  return parts.reduce((total, part) => total + (part.type === 'text' ? part.text.length : 1), 0);
}

/** The parts as they look once `shown` characters are out. */
export function revealParts(parts: readonly MessagePart[], shown: number): MessagePart[] {
  const visible: MessagePart[] = [];
  let budget = shown;
  for (const part of parts) {
    if (budget <= 0) break;
    if (part.type === 'component') {
      visible.push(part);
      budget -= 1;
      continue;
    }
    visible.push(budget >= part.text.length ? part : { ...part, text: part.text.slice(0, budget) });
    budget -= part.text.length;
  }
  return visible;
}

/** About 120 characters a second at 60 frames a second. */
const TYPING_PER_FRAME = 2;
/** How many frames a backlog takes to shrink by about two-thirds. */
const CATCH_UP_FRAMES = 90;

/**
 * Characters to reveal on the next frame. A short answer types at a reading
 * pace; a long one speeds up with what is left, so nobody waits seconds
 * for text that has already arrived.
 */
export function nextStep(backlog: number): number {
  if (backlog <= 0) return 0;
  return Math.min(backlog, Math.max(TYPING_PER_FRAME, Math.ceil(backlog / CATCH_UP_FRAMES)));
}
