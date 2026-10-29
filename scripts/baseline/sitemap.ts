import { JSDOM } from 'jsdom';
import { contrast, diffJson } from './json-diff';

/**
 * A sitemap compared as the list of pages it announces: a changed address is
 * one difference at its position, the same addresses in another order one
 * difference for the order, and each page's language alternates by language.
 */

interface SitemapEntry {
  readonly loc: string;
  readonly alternates: Readonly<Record<string, string>>;
}

export interface SitemapChange {
  readonly path: string;
  readonly detail: string;
}

export function compareSitemaps(baselineXml: string, targetXml: string): SitemapChange[] {
  const baseline = entriesOf(baselineXml);
  const target = entriesOf(targetXml);
  const before = baseline.map(({ loc }) => loc);
  const after = target.map(({ loc }) => loc);
  if (isSameSet(before, after) && before.join('\n') !== after.join('\n')) {
    return [
      { path: 'order', detail: contrast(before, after) },
      ...alternateChanges(baseline, target),
    ];
  }
  return diffJson(baseline, target).map(({ path, baseline: was, target: is }) => ({
    path,
    detail: contrast(was, is),
  }));
}

function isSameSet(before: readonly string[], after: readonly string[]): boolean {
  return (
    before.length === after.length && [...before].sort().join('\n') === [...after].sort().join('\n')
  );
}

/** Once the order is reported, each page's alternates are compared page by page. */
function alternateChanges(baseline: readonly SitemapEntry[], target: readonly SitemapEntry[]) {
  const targetByLoc = new Map(target.map((entry) => [entry.loc, entry]));
  return baseline.flatMap(({ loc, alternates }) =>
    diffJson(alternates, targetByLoc.get(loc)?.alternates).map(
      ({ path, baseline: was, target: is }) => ({
        path: `${loc}.alternates.${path}`,
        detail: contrast(was, is),
      }),
    ),
  );
}

function entriesOf(xml: string): SitemapEntry[] {
  const { document } = new JSDOM(xml, { contentType: 'text/xml' }).window;
  return Array.from(document.getElementsByTagName('url')).map((url) => ({
    loc: url.getElementsByTagName('loc')[0]?.textContent.trim() ?? '',
    alternates: Object.fromEntries(
      Array.from(url.getElementsByTagName('xhtml:link')).map((link) => [
        link.getAttribute('hreflang') ?? '',
        link.getAttribute('href') ?? '',
      ]),
    ),
  }));
}
