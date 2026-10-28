/**
 * How a passage of a public website is credited: one source per page, named
 * by where it lives, so a visitor can open the page the answer drew on.
 */

export function siteSourceId(url: string): string {
  return `site:${url}`;
}

export function siteLabel(url: string): string {
  const { host, pathname } = new URL(url);
  const path = pathname.replace(/\/$/, '');
  return `${host.replace(/^www\./, '')}${path}`;
}

/**
 * A paragraph a site's curation leaves out: written exactly, or as a regular
 * expression between slashes, such as `/^Alex /`.
 */
export function excludePattern(exclude: string): (paragraph: string) => boolean {
  const pattern = /^\/(.+)\/$/s.exec(exclude)?.[1];
  if (pattern === undefined) return (paragraph) => paragraph === exclude;
  const expression = new RegExp(pattern, 'u');
  return (paragraph) => expression.test(paragraph);
}
