import { describe, expect, it } from 'vitest';
import { compareDocuments } from './dom-diff';
import { NORMALIZATIONS } from './normalize';
import { compareSitemaps } from './sitemap';

/**
 * The comparison ignores exactly the build noise its table lists and reports
 * everything else. Documents are shaped like the site's: a head with
 * metadata, a body with structured data and markup.
 */

function page({
  head = '',
  body = '',
  className = 'k9TmIq_variable',
}: { head?: string; body?: string; className?: string } = {}): string {
  return `<!DOCTYPE html><html lang="en" class="${className}"><head>
    <title>Ada Rivera — Platform engineer</title>
    <link rel="canonical" href="https://ada.example/skills">
    ${head}
  </head><body class="bg-bg font-sans">
    <script type="application/ld+json">{"@type":"Person","name":"Ada Rivera"}</script>
    <main><p class="text-ink">Platform engineer.</p>${body}</main>
  </body></html>`;
}

/** Per normalization, two documents that differ only in the noise it ignores. */
const NOISE: Readonly<Record<string, readonly [string, string]>> = {
  'runtime-scripts': [
    page({ body: '<script src="/_next/static/chunks/a1b2.js" async></script>' }),
    page({ body: '<script>self.__next_f.push([1,"build 2"])</script>' }),
  ],
  'resource-links': [
    page({
      head: '<link rel="stylesheet" href="/a.css"><link rel="preload" as="script" href="/a.js">',
    }),
    page({ head: '<link rel="modulepreload" href="/b.js">' }),
  ],
  'next-static-path': [
    page({ body: '<a href="/_next/static/chunks/25-co05vq3qo6.css">build</a>' }),
    page({ body: '<a href="/_next/static/chunks/37kger8l_ntlf.css">build</a>' }),
  ],
  'next-build-id': [
    page({ body: '<a href="/_next/static/k3Lx9QpA/_buildManifest.js">build</a>' }),
    page({ body: '<a href="/_next/static/Zr42mWqT/_buildManifest.js">build</a>' }),
  ],
  'deployment-id': [
    page({ body: '<img src="/ada.jpg?dpl=dpl_8xKq1" alt="">' }),
    page({ body: '<img src="/ada.jpg?dpl=dpl_Zr42m" alt="">' }),
  ],
  'next-font-class': [
    page({ className: '__variable_a1b2c3 __className_d4e5f6' }),
    page({ className: '__variable_0f9e8d __className_7c6b5a' }),
  ],
  'turbopack-font-class': [
    page({ className: 'k9TmIq_variable _8ZaJsW_variable' }),
    page({ className: 'Qw3rTy_variable _1aBcDe_variable' }),
  ],
  'icon-cache-key': [
    page({ head: '<link rel="icon" href="/icon?987b35d80821afbb" type="image/png">' }),
    page({ head: '<link rel="icon" href="/icon?0123456789abcdef" type="image/png">' }),
  ],
};

describe('the build noise the comparison ignores', () => {
  it('has a case here for every entry of the table', () => {
    expect(Object.keys(NOISE).sort()).toEqual(NORMALIZATIONS.map(({ id }) => id).sort());
  });

  it.each(NORMALIZATIONS)('ignores $id, for a stated reason', ({ id, reason }) => {
    const [baseline, target] = NOISE[id] ?? ['', ''];

    expect(baseline).not.toBe(target);
    expect(compareDocuments(baseline, target)).toEqual([]);
    expect(reason.trim()).not.toBe('');
  });
});

describe('a change the table does not name', () => {
  it('reports a class changed on a class that is not hashed, at its element', () => {
    const changes = compareDocuments(
      page({ body: '<span class="a">Lead</span>' }),
      page({ body: '<span class="b">Lead</span>' }),
    );

    expect(changes).toEqual([{ path: 'html>body[0]>main[0]>span[0]@class', detail: '"a" → "b"' }]);
  });

  it('reports a value of the structured data, at its JSON path', () => {
    const changes = compareDocuments(
      page(),
      page().replace('"name":"Ada Rivera"', '"name":"Ada R."'),
    );

    expect(changes).toEqual([
      { path: 'html>body[0]>script[0]#name', detail: '"Ada Rivera" → "Ada R."' },
    ]);
  });

  it('reports a canonical address', () => {
    const changes = compareDocuments(
      page(),
      page().replace('ada.example/skills', 'ada.example/skill'),
    );

    expect(changes).toEqual([
      {
        path: 'html>head[0]>link[0]@href',
        detail: '"https://ada.example/skills" → "https://ada.example/skill"',
      },
    ]);
  });

  it('reports a media file under /_next/static/media/ that changed, its name hashing its bytes', () => {
    const changes = compareDocuments(
      page({ body: '<img src="/_next/static/media/photo.1a2b3c.jpg" alt="">' }),
      page({ body: '<img src="/_next/static/media/photo.9f8e7d.jpg" alt="">' }),
    );

    expect(changes).toEqual([
      {
        path: 'html>body[0]>main[0]>img[0]@src',
        detail: '"/_next/static/media/photo.1a2b3c.jpg" → "/_next/static/media/photo.9f8e7d.jpg"',
      },
    ]);
  });

  it('reports a text the page shows', () => {
    const changes = compareDocuments(
      page(),
      page().replace('Platform engineer.', 'Platform engineer!'),
    );

    expect(changes).toEqual([
      {
        path: 'html>body[0]>main[0]>p[0]>#text[0]',
        detail: '"Platform engineer." → "Platform engineer!"',
      },
    ]);
  });
});

describe('the sitemap', () => {
  const sitemap = (...locs: string[]) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${locs
  .map(
    (loc) =>
      `<url><loc>${loc}</loc><xhtml:link rel="alternate" hreflang="en" href="${loc}" /></url>`,
  )
  .join('\n')}
</urlset>`;
  const HOME = 'https://ada.example/';
  const SKILLS = 'https://ada.example/skills';

  it('reports a changed address once, at its position', () => {
    const changes = compareSitemaps(
      sitemap(HOME, SKILLS),
      sitemap(HOME, SKILLS).replace(`<loc>${SKILLS}</loc>`, `<loc>${SKILLS}/</loc>`),
    );

    expect(changes).toEqual([{ path: '[1].loc', detail: `"${SKILLS}" → "${SKILLS}/"` }]);
  });

  it('reports the same addresses in another order once', () => {
    const changes = compareSitemaps(sitemap(HOME, SKILLS), sitemap(SKILLS, HOME));

    expect(changes).toEqual([
      { path: 'order', detail: `["${HOME}","${SKILLS}"] → ["${SKILLS}","${HOME}"]` },
    ]);
  });

  it('finds nothing in an identical sitemap', () => {
    expect(compareSitemaps(sitemap(HOME, SKILLS), sitemap(HOME, SKILLS))).toEqual([]);
  });
});
