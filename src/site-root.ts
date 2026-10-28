import 'server-only';
import { siteUrl } from '@/env';
import { profile } from '@/profile';
import { fontClassName } from '@/profile/fonts';
import { createSite } from '@/site/create-site';

/**
 * The only place the pages are bound to the owner's profile, on the server:
 * the browser receives plain props, never the record.
 */
export const site = createSite(profile, { fontClassName, siteUrl });
