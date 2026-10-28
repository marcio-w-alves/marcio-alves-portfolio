import 'server-only';
import { locale } from 'next/root-params';
import { siteUrl } from '@/env';
import { profile } from '@/profile';
import { fontClassName } from '@/profile/fonts';
import { createSite } from '@/site/create-site';
import { publishedLocales } from '@/site/published-locales';

/**
 * The only place the pages are bound to the owner's profile, on the server:
 * the browser receives plain props, never the record.
 */
export const site = createSite(profile, {
  fontClassName,
  siteUrl,
  locales: publishedLocales(profile.locales, process.env),
  localeSegment: locale,
});
