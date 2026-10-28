import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import { localize } from '@/core/knowledge/localize';
import { profile } from '@/profile';
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

  it('links to the whole address when it contains parentheses', () => {
    render(
      <p>
        <InlineText text="[Angular](https://en.wikipedia.org/wiki/Angular_(web_framework))" />
      </p>,
    );
    expect(screen.getByRole('link', { name: opensInNewTab('Angular') })).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Angular_(web_framework)',
    );
  });

  it('links the résumé the fast path offers, on this site, in the same tab', () => {
    const fastPath = createFastPath(localize(profile.knowledge, 'en'), profile.copy.en.answers);
    const result = fastPath.answer('Can I see his resume?', {
      topic: 'overview',
      lastIntent: null,
      ctaShown: false,
    });
    const [lead] = result.kind === 'answered' ? result.response.parts : [];
    const text = lead?.type === 'text' ? lead.text : '';

    render(
      <p>
        <InlineText text={text} />
      </p>,
    );

    const link = screen.getByRole('link', { name: 'open his resume as a PDF' });
    expect(link).toHaveAttribute('href', profile.knowledge.contact.resumeUrl);
    expect(link).not.toHaveAttribute('target');
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

  it('links a repository named in bold, keeping it bold', () => {
    render(
      <p>
        <InlineText text="**[portfolio](https://github.com/marcio-w-alves/portfolio)**" />
      </p>,
    );
    const link = screen.getByRole('link', { name: opensInNewTab('portfolio') });
    expect(link).toHaveAttribute('href', 'https://github.com/marcio-w-alves/portfolio');
    expect(link.closest('strong')).not.toBeNull();
  });
});
