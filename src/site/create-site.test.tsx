import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fixtureSiteProfile } from '@/testing/fixture-profile';
import { createSite } from './create-site';

/** The site the fictional person's profile builds: nothing of the owner's may show through. */
const site = createSite(fixtureSiteProfile, {
  fontClassName: '',
  siteUrl: () => new URL('https://ada.example'),
});

function rendered(page: React.ReactNode): Document {
  const html = renderToStaticMarkup(<site.RootLayout>{page}</site.RootLayout>);
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('a site built from another profile', () => {
  const home = rendered(<site.HomePage />);

  it('titles and describes itself with that profile', () => {
    expect(site.rootMetadata()).toMatchObject({
      title: 'Ada Rivera — Principal Platform Engineer',
      description:
        'Portfolio of Ada Rivera, Principal Platform Engineer. Ask its assistant about her platform work.',
    });
    expect(site.shareImageAlt).toBe('Ada Rivera, Principal Platform Engineer');
  });

  it("greets the visitor with that person's welcome", () => {
    expect(home.querySelector('h1')?.textContent).toBe("Hi, I'm Ada");
  });

  it("offers that person's contact, with its own email subject, and résumé", () => {
    const hrefs = [...home.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'mailto:ada@rivera.example?subject=Platform%20role',
        'https://www.linkedin.com/in/ada-rivera-example',
        'https://github.com/ada-rivera-example',
        '/ada-rivera-cv.pdf',
      ]),
    );
  });

  it('describes that person to search engines', () => {
    const json = home.querySelector('script[type="application/ld+json"]')?.textContent ?? '';
    const { '@graph': graph } = JSON.parse(json) as { '@graph': Record<string, unknown>[] };
    expect(graph.find((node) => node['@type'] === 'Person')).toMatchObject({
      name: 'Ada Rivera',
      jobTitle: 'Principal Platform Engineer',
      sameAs: [
        'https://www.linkedin.com/in/ada-rivera-example',
        'https://github.com/ada-rivera-example',
      ],
    });
  });

  it('writes the interface in the default English, leaving no placeholder unfilled', () => {
    const text = home.body.textContent;
    expect(text).toContain('Get in touch');
    expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
    const attributes = [...home.querySelectorAll('[aria-label],[placeholder],[title]')].flatMap(
      (element) => ['aria-label', 'placeholder', 'title'].map((name) => element.getAttribute(name)),
    );
    expect(attributes.join(' ')).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('answers an unknown address with its own not-found page, leading home', () => {
    const missing = rendered(<site.NotFound />);
    expect(missing.querySelector('h1')?.textContent).toBe('Page not found');
    const home = [...missing.querySelectorAll('a')].find(
      (link) => link.textContent === 'Go to the home page',
    );
    expect(home?.getAttribute('href')).toBe('/');
  });

  it('titles a topic page with its topic and the person', () => {
    expect(site.topicPage('experience').metadata.title).toBe('Experience — Ada Rivera');
  });
});
