import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { AnswerBody } from './answer-body';

const REPOSITORIES = [
  'Here are his public repositories:',
  '',
  '1. **[pipewright](https://github.com/ada-rivera-example/pipewright)** — a CI runner.',
  '2. **[loomstack-api](https://github.com/ada-rivera-example/loomstack-api)** — a service catalogue API.',
].join('\n');

describe('AnswerBody', () => {
  it('links each repository the answer names in bold, without showing the Markdown', () => {
    renderWithMessages(
      <AnswerBody parts={[{ type: 'text', id: 'a', text: REPOSITORIES }]} streaming={false} />,
    );

    expect(screen.getByRole('link', { name: /^pipewright/ })).toHaveAttribute(
      'href',
      'https://github.com/ada-rivera-example/pipewright',
    );
    expect(screen.getByRole('link', { name: /^loomstack-api/ })).toHaveAttribute(
      'href',
      'https://github.com/ada-rivera-example/loomstack-api',
    );
    expect(screen.queryByText(/\]\(https:/)).not.toBeInTheDocument();
  });

  it('numbers each repository in turn when a description follows each one', () => {
    const described = [
      '1. **first-repo**',
      '',
      'A portfolio.',
      '',
      '2. **second-repo**',
      '',
      'A training API.',
      '',
      '3. **third-repo**',
    ].join('\n');
    renderWithMessages(
      <AnswerBody parts={[{ type: 'text', id: 'a', text: described }]} streaming={false} />,
    );

    const lists = screen.getAllByRole('list');
    expect(lists.map((list) => [list.getAttribute('start'), list.textContent])).toEqual([
      ['1', 'first-repo'],
      ['2', 'second-repo'],
      ['3', 'third-repo'],
    ]);
  });
});
