import type { Locale } from '@/core/i18n/locale';
import { englishUiMessages } from './en';
import { portugueseUiMessages } from './pt-BR';
import type { UiMessages } from './ui-messages';

/** The interface in each language, before a profile words any of it its own way. */
export const DEFAULT_UI_MESSAGES: Readonly<Record<Locale, UiMessages>> = {
  en: englishUiMessages,
  'pt-BR': portugueseUiMessages,
};
