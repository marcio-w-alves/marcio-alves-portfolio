'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/core/i18n/locale';
import type { UiMessages } from './ui-messages';

interface I18n {
  /** The page's language, which also picks its plural rules and number formats. */
  readonly locale: Locale;
  readonly messages: UiMessages;
}

const I18nContext = createContext<I18n | null>(null);

interface I18nProviderProps extends I18n {
  readonly children: ReactNode;
}

/** Hands the page's catalog — one language, already about its owner — to the interface. */
export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  return <I18nContext value={{ locale, messages }}>{children}</I18nContext>;
}

function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('The interface is rendered outside an I18nProvider.');
  return i18n;
}

export function useMessages(): UiMessages {
  return useI18n().messages;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
