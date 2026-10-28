import { describe, expect, it } from 'vitest';
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
