import { describe, expect, it } from 'vitest';
import { summarizePage } from './page-summary';
import { text } from './response-kit';

describe('summarizePage', () => {
  it('describes each card by what it shows, and keeps the page text', () => {
    const summary = summarizePage([
      text('### How his scope grew\n- 2015–2018: freelance'),
      {
        type: 'component',
        component: 'skills',
        props: { groups: [{ title: 'Frontend', items: ['React', 'TypeScript'] }] },
      },
    ]);
    expect(summary).toContain('### How his scope grew');
    expect(summary).toContain('Skills by area: Frontend: React, TypeScript');
  });

  it('leaves out notes and the contact card, which are not part of the record', () => {
    expect(
      summarizePage([
        { type: 'component', component: 'note', props: { tone: 'info', text: 'Aside' } },
      ]),
    ).toBe('');
  });

  it('keeps a long page within bounds', () => {
    expect(
      summarizePage([text('x'.repeat(5000)), text('y'.repeat(5000))]).length,
    ).toBeLessThanOrEqual(4000);
  });
});
