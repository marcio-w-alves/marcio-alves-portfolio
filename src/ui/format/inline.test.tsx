import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineText } from './inline';

// jsdom's accessible-name computation trims the space a browser keeps before the hidden note.
function opensInNewTab(label: string): RegExp {
  return new RegExp(`^${label} ?\\(opens in a new tab\\)$`);
}

describe('InlineText', () => {
  it('opens a web link in a new tab and says so to screen readers', () => {
    render(
      <p>
        <InlineText text="See [his GitHub](https://github.com/marcio-w-alves)." />
      </p>,
    );
    const link = screen.getByRole('link', { name: opensInNewTab('his GitHub') });
    expect(link).toHaveAttribute('href', 'https://github.com/marcio-w-alves');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps a mailto link in the same tab', () => {
    render(
      <p>
        <InlineText text="[Write to him](mailto:marcio@example.com)" />
      </p>,
    );
    const link = screen.getByRole('link', { name: 'Write to him' });
    expect(link).toHaveAttribute('href', 'mailto:marcio@example.com');
    expect(link).not.toHaveAttribute('target');
  });

  it('shows an unsafe link as the text it was, with nothing to click', () => {
    render(
      <p data-testid="text">
        <InlineText text="[click](javascript:alert(1))" />
      </p>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTestId('text')).toHaveTextContent('[click](javascript:alert(1))');
  });

  it('renders markup in the text as visible text, not as elements', () => {
    render(
      <p data-testid="text">
        <InlineText text="<img src=x onerror=alert(1)><b>bold</b>" />
      </p>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('text')).toHaveTextContent('<img src=x onerror=alert(1)><b>bold</b>');
  });

  it('emphasises bold text and marks up code', () => {
    render(
      <p>
        <InlineText text="Built with **TypeScript** and `zod`." />
      </p>,
    );
    expect(screen.getByText('TypeScript').tagName).toBe('STRONG');
    expect(screen.getByText('zod').tagName).toBe('CODE');
  });
});
