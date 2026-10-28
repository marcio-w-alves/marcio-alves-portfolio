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
