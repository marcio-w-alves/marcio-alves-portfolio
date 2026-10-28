import { render, type RenderOptions } from '@testing-library/react';
import { Fragment, type ReactElement, type ReactNode } from 'react';
import type { Locale } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import { siteMessages } from '@/site/site-messages';
import { I18nProvider } from '@/ui/i18n/i18n-provider';
import type { UiMessages } from '@/ui/i18n/ui-messages';
import { fixtureSiteProfile } from './fixture-profile/site-profile';

/** The interface's catalog as the fictional person's pages receive it. */
export const fixtureUiMessages: UiMessages = siteMessages(
  localize(fixtureSiteProfile.knowledge, 'en'),
  fixtureSiteProfile.copy.en,
  'en',
).ui;

/** The default Portuguese interface, about the fictional person, who words none of it. */
export const fixturePortugueseUiMessages: UiMessages = siteMessages(
  localize(fixtureSiteProfile.knowledge, 'pt-BR'),
  { ui: {}, site: {} },
  'pt-BR',
).ui;

/** A wrapper that hands a catalog to the interface, as the root layout does. */
export function withMessages(messages: UiMessages = fixtureUiMessages, locale: Locale = 'en') {
  return function MessagesWrapper({ children }: { readonly children: ReactNode }) {
    return (
      <I18nProvider locale={locale} messages={messages}>
        {children}
      </I18nProvider>
    );
  };
}

/**
 * Renders a part of the interface inside the fixture's catalog, and inside
 * `wrapper` too where the part needs more around it.
 */
export function renderWithMessages(ui: ReactElement, { wrapper, ...options }: RenderOptions = {}) {
  const Messages = withMessages();
  const Inner = wrapper ?? Fragment;
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <Messages>
        <Inner>{children}</Inner>
      </Messages>
    ),
  });
}
