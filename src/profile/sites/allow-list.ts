import type { SiteEntry } from '../schema';

/**
 * The public pages `pnpm sites:ingest` reads into the record. Each is fetched
 * as written, robots.txt permitting, and nothing it links to is followed.
 *
 * Left out, on purpose: this portfolio's own site (the record already
 * describes it); Maison Moderne, whose site is a page of template text, and
 * Paperjam, whose robots.txt turns language-model crawlers away; Roots, which
 * Deel acquired and which keeps no site of its own; and Shall And Partners,
 * WEBFI and the freelance work, which have no public site the record can
 * confirm.
 */
export const siteAllowList: readonly SiteEntry[] = [
  {
    subject: { kind: 'project', id: 'evcopilot' },
    urls: ['https://evcopilotapp.io/'],
    termsNote: "Marcio's own product; reviewed 2026-10-28.",
  },
  {
    subject: { kind: 'project', id: 'formdaily' },
    urls: ['https://formdaily.app/'],
    termsNote: "Marcio's own product; reviewed 2026-10-28.",
  },
  {
    subject: { kind: 'project', id: 'targup' },
    urls: ['https://dev.targup.com/'],
    termsNote:
      "Marcio's own product, at the preview address the record links; reviewed 2026-10-28.",
  },
  {
    subject: { kind: 'company', id: 'way2b1' },
    urls: ['https://www.way2b1.com/'],
    termsNote: 'Company home page; robots.txt allows every crawler. Reviewed 2026-10-28.',
  },
  {
    subject: { kind: 'company', id: 'deel' },
    urls: ['https://www.deel.com/about/'],
    termsNote:
      'Company "about" page; robots.txt allows general crawlers and declares ai-input=yes. Reviewed 2026-10-28.',
  },
];
