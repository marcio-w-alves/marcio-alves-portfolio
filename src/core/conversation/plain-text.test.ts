import { describe, expect, it } from 'vitest';
import { details, note, projects, timeline } from '../assistant/response-kit';
import { toPlainText } from './plain-text';

describe('an answer as plain text', () => {
  it('drops inline markup but keeps a link target readable', () => {
    expect(
      toPlainText([
        {
          type: 'text',
          id: 'p0',
          text: 'He led **HRIS** in `React` — see [GitHub](https://github.com/marcio-w-alves).',
        },
      ]),
    ).toBe('He led HRIS in React — see GitHub (https://github.com/marcio-w-alves).');
  });

  it.each([
    ['a timeline as one line per role', timeline(['deel']), /^• 2022 — 2026 · Deel · Senior/],
    ['project cards as one line per product', projects(['evcopilot']), /^• EvCopilot — \S/],
    ['a note without its markup', note('info', 'Not **documented**.'), /^Not documented\.$/],
    [
      'details as their summary, then their text',
      details('Why it matters', 'It cut `load` time.'),
      /^Why it matters\nIt cut load time\.$/,
    ],
  ])('writes %s', (_label, part, expected) => {
    expect(toPlainText([{ ...part, id: 'p0' }])).toMatch(expected);
  });

  it('writes skills as one line per group', () => {
    expect(
      toPlainText([
        {
          type: 'component',
          id: 'p0',
          component: 'skills',
          props: {
            groups: [
              { title: 'Frontend', items: ['React', 'TypeScript'] },
              { title: 'Backend', items: ['Node.js'] },
            ],
          },
        },
      ]),
    ).toBe('Frontend: React, TypeScript\nBackend: Node.js');
  });

  it('leaves out the context of a metric that has none', () => {
    expect(
      toPlainText([
        {
          type: 'component',
          id: 'p0',
          component: 'metrics',
          props: { items: [{ value: '3×', label: 'Team size' }] },
        },
      ]),
    ).toBe('• 3× — Team size');
  });

  it('turns blocks into short readable lines, separated from the text', () => {
    expect(
      toPlainText([
        { type: 'text', id: 'p0', text: 'Results:' },
        {
          type: 'component',
          id: 'p1',
          component: 'metrics',
          props: { items: [{ value: '50%', label: 'Faster critical pages', context: 'Deel' }] },
        },
        {
          type: 'component',
          id: 'p2',
          component: 'table',
          props: {
            columns: ['Signal', 'Where'],
            rows: [['Team building', 'Roots']],
            caption: 'Signals',
          },
        },
      ]),
    ).toBe(
      'Results:\n\n• 50% — Faster critical pages (Deel)\n\nSignal | Where\nTeam building | Roots',
    );
  });

  it('gives the contact channels, not the card', () => {
    expect(
      toPlainText([
        {
          type: 'component',
          id: 'p0',
          component: 'contact',
          props: {
            heading: 'Get in touch',
            text: 'Reach out',
            email: 'marcio.welben@gmail.com',
            linkedin: 'https://www.linkedin.com/in/marcio-montenegro',
            github: 'https://github.com/marcio-w-alves',
            resumeUrl: null,
          },
        },
      ]),
    ).toBe(
      'Email: marcio.welben@gmail.com\nLinkedIn: https://www.linkedin.com/in/marcio-montenegro',
    );
  });

  it('leaves out empty text parts', () => {
    expect(
      toPlainText([
        { type: 'text', id: 'p0', text: '' },
        { type: 'text', id: 'p1', text: 'Hi' },
      ]),
    ).toBe('Hi');
  });
});
