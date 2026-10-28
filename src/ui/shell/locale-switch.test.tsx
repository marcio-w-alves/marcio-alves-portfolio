import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/core/i18n/locale';
import {
  fixturePortugueseUiMessages,
  fixtureUiMessages,
  withMessages,
} from '@/testing/ui-messages';
import { LocaleSwitch, type LocaleLink } from './locale-switch';

const SKILLS: readonly LocaleLink[] = [
  { locale: 'en', href: '/skills', short: 'EN', name: 'English' },
  { locale: 'pt-BR', href: '/pt/skills', short: 'PT', name: 'Português' },
];

function renderOn(locale: Locale, languages: readonly LocaleLink[] = SKILLS) {
  const messages = locale === 'en' ? fixtureUiMessages : fixturePortugueseUiMessages;
  return render(<LocaleSwitch languages={languages} />, {
    wrapper: withMessages(messages, locale),
  });
}

describe('the language switcher', () => {
  it('links to this page in each language, each named in its own language', () => {
    renderOn('en');
    const nav = screen.getByRole('navigation', { name: 'Language' });

    const english = within(nav).getByRole('link', { name: 'English' });
    const portuguese = within(nav).getByRole('link', { name: 'Português' });

    expect(english).toHaveAttribute('href', '/skills');
    expect(english).toHaveAttribute('lang', 'en');
    expect(english).toHaveAttribute('hreflang', 'en');
    expect(portuguese).toHaveAttribute('href', '/pt/skills');
    expect(portuguese).toHaveAttribute('lang', 'pt-BR');
    expect(portuguese).toHaveAttribute('hreflang', 'pt-BR');
  });

  it("marks only the reader's language as the current page", () => {
    renderOn('pt-BR');
    const nav = screen.getByRole('navigation', { name: 'Idioma' });

    const current = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toEqual([within(nav).getByRole('link', { name: 'Português' })]);
  });

  it('renders nothing while the site speaks a single language', () => {
    const { container } = renderOn('en', SKILLS.slice(0, 1));
    expect(container).toBeEmptyDOMElement();
  });
});
