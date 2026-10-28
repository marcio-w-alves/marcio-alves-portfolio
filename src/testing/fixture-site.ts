import { LOCALE_SEGMENT, type Locale } from '@/core/i18n/locale';
import { createSite } from '@/site/create-site';
import type { SiteProfile } from '@/site/site-profile';
import { fixtureSiteProfile } from './fixture-profile/site-profile';

interface FixtureSiteOptions {
  /** The languages the build serves. */
  readonly locales?: readonly Locale[];
  /** The language of the page being rendered. */
  readonly on?: Locale;
  readonly profile?: SiteProfile;
}

/** The site the fictional person's profile builds, rendering a page in one language. */
export function fixtureSite({
  locales = ['en'],
  on = 'en',
  profile = fixtureSiteProfile,
}: FixtureSiteOptions = {}) {
  return createSite(profile, {
    fontClassName: '',
    siteUrl: () => new URL('https://ada.example'),
    locales,
    localeSegment: () => Promise.resolve(LOCALE_SEGMENT[on]),
  });
}
