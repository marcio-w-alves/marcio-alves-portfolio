import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnswerBody } from './answer-body';

const REPOSITORIES = [
  'Here are his public repositories:',
  '',
  '1. **[marcio-alves-portfolio](https://github.com/marcio-w-alves/marcio-alves-portfolio)** — this site.',
  '2. **[trainly-api](https://github.com/marcio-w-alves/trainly-api)** — a training API.',
].join('\n');

describe('AnswerBody', () => {
  it('links each repository the answer names in bold, without showing the Markdown', () => {
    render(
      <AnswerBody parts={[{ type: 'text', id: 'a', text: REPOSITORIES }]} streaming={false} />,
    );

    expect(screen.getByRole('link', { name: /^marcio-alves-portfolio/ })).toHaveAttribute(
      'href',
      'https://github.com/marcio-w-alves/marcio-alves-portfolio',
    );
    expect(screen.getByRole('link', { name: /^trainly-api/ })).toHaveAttribute(
      'href',
      'https://github.com/marcio-w-alves/trainly-api',
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
    render(<AnswerBody parts={[{ type: 'text', id: 'a', text: described }]} streaming={false} />);

    const lists = screen.getAllByRole('list');
    expect(lists.map((list) => [list.getAttribute('start'), list.textContent])).toEqual([
      ['1', 'first-repo'],
      ['2', 'second-repo'],
      ['3', 'third-repo'],
    ]);
  });
});
