import { interpolate, mapMessages, overrideMessages, type Overrides } from '@/core/i18n/format';
import type { Knowledge } from '@/core/knowledge/schema';
import { englishUiMessages } from '@/ui/i18n/en';
import type { UiMessages } from '@/ui/i18n/ui-messages';
import { englishSiteCopy, type SiteCopy } from './site-copy';

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

function about<T>(catalog: T, subject: Subject): T {
  return mapMessages(catalog, (message) => interpolate(message, subject));
}

/**
 * The default catalogs with the profile's overrides in place, and the person's
 * name and headline written in, so the browser receives finished text.
 */
export function siteMessages({ profile }: Knowledge, overrides: CopyOverrides): SiteMessages {
  const subject = { name: profile.name, firstName: profile.firstName, title: profile.title };
  return {
    ui: about(overrideMessages(englishUiMessages, overrides.ui), subject),
    site: about(overrideMessages(englishSiteCopy, overrides.site), subject),
  };
}
