import { describe, expect, it } from 'vitest';
import type { MessagePart } from '@/core/conversation/messages';
import { nextStep, revealLength, revealParts } from './reveal';

const parts: MessagePart[] = [
  { type: 'text', id: 'a', text: 'Hello there.' },
  { type: 'component', id: 'b', component: 'note', props: { tone: 'info', text: 'Note' } },
  { type: 'text', id: 'c', text: 'After.' },
];

describe('revealing an answer as it is typed', () => {
  it('counts every character of text and each rich block as one', () => {
    expect(revealLength(parts)).toBe('Hello there.'.length + 1 + 'After.'.length);
  });

  it('cuts the text being typed and holds back everything after it', () => {
    expect(revealParts(parts, 5)).toEqual([{ type: 'text', id: 'a', text: 'Hello' }]);
  });

  it('shows a rich block only once the text before it is out', () => {
    expect(revealParts(parts, 12)).toEqual([parts[0]]);
    expect(revealParts(parts, 13)).toEqual([parts[0], parts[1]]);
  });

  it('shows nothing before the first character, and everything once all are out', () => {
    expect(revealParts(parts, 0)).toEqual([]);
    expect(revealParts(parts, revealLength(parts))).toEqual(parts);
  });
});

describe('typing pace', () => {
  it('types a little at a time while little is left', () => {
    expect(nextStep(40)).toBe(2);
  });

  it('never types past what has arrived', () => {
    expect(nextStep(1)).toBe(1);
    expect(nextStep(0)).toBe(0);
  });

  it('speeds up with a long backlog, so a long answer still finishes in seconds', () => {
    let backlog = 3000;
    let frames = 0;
    while (backlog > 0) {
      backlog -= nextStep(backlog);
      frames += 1;
    }
    expect(nextStep(3000)).toBeGreaterThan(2);
    expect(frames / 60).toBeLessThan(6);
  });
});
