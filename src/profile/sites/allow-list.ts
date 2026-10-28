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
    // The preview's own error message, shown when its product list fails to load.
    excludes: ['/^We couldn.t load the product list/'],
    termsNote:
      "Marcio's own product, at the preview address the record links; reviewed 2026-10-28.",
  },
  {
    subject: { kind: 'company', id: 'way2b1' },
    urls: ['https://www.way2b1.com/'],
    // A client's testimonial: a claim about results, and not about the product.
    excludes: ['/doubled our client base/'],
    termsNote: 'Company home page; robots.txt allows every crawler. Reviewed 2026-10-28.',
  },
  {
    subject: { kind: 'company', id: 'deel' },
    urls: ['https://www.deel.com/about/'],
    // Only what the company does: the founders' biographies would put another "he" beside
    // Marcio's, and the funding and customer counts contradict one another across the page.
    excludes: [
      '/^Trusted by [\\d,]+\\+? companies/',
      '/^After graduating from MIT/',
      '/^The duo started Deel/',
      '/^Alex /',
      '/^Outside of Deel, Alex/',
      '/^We’re backed by the best/',
      '/raised \\$[\\d,]+ million/',
    ],
    termsNote:
      'Company "about" page; robots.txt allows general crawlers and declares ai-input=yes. Reviewed 2026-10-28.',
  },
];
