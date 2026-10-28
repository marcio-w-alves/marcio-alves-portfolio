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
});
