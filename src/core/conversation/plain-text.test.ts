import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { createResponseKit, details, note } from '../assistant/response-kit';
import { toPlainText } from './plain-text';

const { projects, timeline } = createResponseKit(localize(fixtureKnowledge, 'en'));

describe('an answer as plain text', () => {
  it('drops inline markup but keeps a link target readable', () => {
    expect(
      toPlainText([
        {
          type: 'text',
          id: 'p0',
          text: 'He led **payroll** in `React` — see [GitHub](https://github.com/ada-rivera-example).',
        },
      ]),
    ).toBe('He led payroll in React — see GitHub (https://github.com/ada-rivera-example).');
  });

  it.each([
    ['a timeline as one line per role', timeline(['globex']), /^• 2018 — 2022 · Globex · Senior/],
    ['project cards as one line per product', projects(['pipewright']), /^• Pipewright — \S/],
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
          props: { items: [{ value: '50%', label: 'Faster critical pages', context: 'Acme' }] },
        },
        {
          type: 'component',
          id: 'p2',
          component: 'table',
          props: {
            columns: ['Signal', 'Where'],
            rows: [['Team building', 'Globex']],
            caption: 'Signals',
          },
        },
      ]),
    ).toBe(
      'Results:\n\n• 50% — Faster critical pages (Acme)\n\nSignal | Where\nTeam building | Globex',
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
            availability: 'Portugal · hybrid',
            email: 'ada@rivera.example',
            linkedin: 'https://www.linkedin.com/in/ada-rivera-example',
            github: 'https://github.com/ada-rivera-example',
            resumeUrl: null,
          },
        },
      ]),
    ).toBe('Email: ada@rivera.example\nLinkedIn: https://www.linkedin.com/in/ada-rivera-example');
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
