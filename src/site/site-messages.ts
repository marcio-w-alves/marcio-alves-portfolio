import { interpolate, mapMessages, overrideMessages, type Overrides } from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import type { Knowledge } from '@/core/knowledge/schema';
import { DEFAULT_UI_MESSAGES } from '@/ui/i18n/defaults';
import type { UiMessages } from '@/ui/i18n/ui-messages';
import { englishSiteCopy, portugueseSiteCopy, type SiteCopy } from './site-copy';

/** How a profile words the interface and the pages differently from the defaults. */
export interface CopyOverrides {
  readonly ui: Overrides<UiMessages>;
  readonly site: Overrides<SiteCopy>;
}

/** The catalogs a page is rendered with, already about the person the site is for. */
export interface SiteMessages {
  readonly ui: UiMessages;
  readonly site: SiteCopy;
}

type Subject = Readonly<Record<'name' | 'firstName' | 'title', string>>;

/** What anyone's portfolio says in each language, before a profile words any of it its own way. */
export const DEFAULT_MESSAGES: Readonly<Record<Locale, SiteMessages>> = {
  en: { ui: DEFAULT_UI_MESSAGES.en, site: englishSiteCopy },
  'pt-BR': { ui: DEFAULT_UI_MESSAGES['pt-BR'], site: portugueseSiteCopy },
};

function about<T>(catalog: T, subject: Subject): T {
  return mapMessages(catalog, (message) => interpolate(message, subject));
}

/**
 * The language's default catalogs with the profile's overrides in place, and
 * the person's name and headline written in, so the browser receives
 * finished text.
 */
export function siteMessages(
  { profile }: Knowledge,
  overrides: CopyOverrides,
  locale: Locale,
): SiteMessages {
  const subject = { name: profile.name, firstName: profile.firstName, title: profile.title };
  const defaults = DEFAULT_MESSAGES[locale];
  return {
    ui: about(overrideMessages(defaults.ui, overrides.ui), subject),
    site: about(overrideMessages(defaults.site, overrides.site), subject),
  };
}
