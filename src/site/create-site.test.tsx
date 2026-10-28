import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fixtureSiteProfile } from '@/testing/fixture-profile';
import { fixtureSite } from '@/testing/fixture-site';

type Site = ReturnType<typeof fixtureSite>;

/** A page as the root layout wraps it, the way Next renders the two server components. */
async function rendered(site: Site, page: () => Promise<ReactNode>): Promise<Document> {
  const html = renderToStaticMarkup(await site.RootLayout({ children: await page() }));
  return new DOMParser().parseFromString(html, 'text/html');
}

function hrefsIn(document: Document): (string | null)[] {
  return [...document.querySelectorAll('a')].map((link) => link.getAttribute('href'));
}

describe('a site built from another profile', async () => {
  const site = fixtureSite();
  const home = await rendered(site, site.HomePage);

  it('titles and describes itself with that profile', async () => {
    expect(await site.rootMetadata()).toMatchObject({
      title: 'Ada Rivera — Principal Platform Engineer',
      description:
        'Portfolio of Ada Rivera, Principal Platform Engineer. Ask its assistant about her platform work.',
      openGraph: { images: [{ alt: 'Ada Rivera, Principal Platform Engineer' }] },
    });
  });

  it("greets the visitor with that person's welcome", () => {
    expect(home.querySelector('h1')?.textContent).toBe("Hi, I'm Ada");
  });

  it("offers that person's contact, with its own email subject, and résumé", () => {
    expect(hrefsIn(home)).toEqual(
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
    expect(home.documentElement.lang).toBe('en');
    const text = home.body.textContent;
    expect(text).toContain('Get in touch');
    expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
    const attributes = [...home.querySelectorAll('[aria-label],[placeholder],[title]')].flatMap(
      (element) => ['aria-label', 'placeholder', 'title'].map((name) => element.getAttribute(name)),
    );
    expect(attributes.join(' ')).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('answers an unknown address with its own not-found page, leading home', async () => {
    const missing = await rendered(site, site.NotFound);
    expect(missing.querySelector('h1')?.textContent).toBe('Page not found');
    const link = [...missing.querySelectorAll('a')].find(
      (anchor) => anchor.textContent === 'Go to the home page',
    );
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('titles a topic page with its topic and the person', async () => {
    expect((await site.topicPage('experience').generateMetadata()).title).toBe(
      'Experience — Ada Rivera',
    );
  });

  it('prerenders only English, the one language it publishes', () => {
    expect(site.localeParams()).toEqual([{ locale: 'en' }]);
  });
});

describe('a site that publishes only English', async () => {
  const site = fixtureSite({ locales: ['en'] });
  const page = await rendered(site, site.topicPage('skills').Page);

  it('shows no language switcher and lists no other language', async () => {
    expect(page.querySelector('nav[aria-label="Language"]')).toBeNull();
    expect(hrefsIn(page).filter((href) => href?.startsWith('/pt'))).toEqual([]);
    expect((await site.topicPage('skills').generateMetadata()).alternates).toEqual({
      canonical: '/skills',
    });
    expect(site.sitemap().map(({ url }) => url)).not.toContainEqual(expect.stringContaining('/pt'));
  });

  it('serves no page from the Portuguese segment', async () => {
    const pt = fixtureSite({ locales: ['en'], on: 'pt-BR' });
    await expect(pt.HomePage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

describe('a site that also publishes Portuguese', async () => {
  const locales = ['en', 'pt-BR'] as const;
  const english = fixtureSite({ locales });
  const portuguese = fixtureSite({ locales, on: 'pt-BR' });
  const page = await rendered(portuguese, portuguese.topicPage('skills').Page);
  const switcher = (document: Document) => document.querySelector('nav[aria-label="Idioma"]');

  it('prerenders every page in both languages', () => {
    expect(portuguese.localeParams()).toEqual([{ locale: 'en' }, { locale: 'pt' }]);
  });

  it('declares the page Portuguese and writes its interface and navigation in Portuguese', () => {
    expect(page.documentElement.lang).toBe('pt-BR');
    expect(page.body.textContent).toContain('Entre em contato');
    expect(page.body.textContent).not.toContain('Get in touch');
    expect(hrefsIn(page)).toEqual(expect.arrayContaining(['/pt', '/pt/experience', '/pt/skills']));
    expect(hrefsIn(page)).not.toContain('/experience');
  });

  it("links the switcher to this page in each language, marking Portuguese as the reader's", () => {
    const links = [...(switcher(page)?.querySelectorAll('a') ?? [])].map((link) => ({
      href: link.getAttribute('href'),
      lang: link.getAttribute('lang'),
      current: link.getAttribute('aria-current'),
      text: link.textContent,
    }));
    expect(links).toEqual([
      { href: '/skills', lang: 'en', current: null, text: 'ENEnglish' },
      { href: '/pt/skills', lang: 'pt-BR', current: 'page', text: 'PTPortuguês' },
    ]);
  });

  it('marks English as current on the English page', async () => {
    const englishPage = await rendered(english, english.topicPage('skills').Page);
    const current = englishPage.querySelector('nav[aria-label="Language"] a[aria-current="page"]');
    expect(current?.getAttribute('href')).toBe('/skills');
  });

  it('answers an unknown Portuguese address with the not-found page in Portuguese', async () => {
    const missing = await rendered(portuguese, portuguese.NotFound);
    expect(missing.documentElement.lang).toBe('pt-BR');
    expect(missing.querySelector('h1')?.textContent).toBe('Página não encontrada');
    const home = [...missing.querySelectorAll('a')].find(
      (link) => link.textContent === 'Ir para a página inicial',
    );
    expect(home?.getAttribute('href')).toBe('/pt');
  });

  it('describes the Portuguese pages as Portuguese, with both languages as alternates', async () => {
    expect(await portuguese.rootMetadata()).toMatchObject({
      openGraph: { locale: 'pt_BR', images: [{ url: '/pt/brand/share-image.png' }] },
    });
    expect((await portuguese.homeMetadata()).alternates).toEqual({
      canonical: '/pt',
      languages: { en: '/', 'pt-BR': '/pt', 'x-default': '/' },
    });
    expect(portuguese.sitemap()).toHaveLength(12);
  });
});

describe('the page about the site, which only English writes yet', async () => {
  const about = {
    label: 'About this site',
    title: 'How it is built',
    description: 'How the site is built.',
    markdown: '## The stack\n\nPlain TypeScript.',
  };
  const profile = {
    ...fixtureSiteProfile,
    copy: { en: { ...fixtureSiteProfile.copy.en, about } },
  };
  const locales = ['en', 'pt-BR'] as const;
  const english = fixtureSite({ locales, profile });
  const portuguese = fixtureSite({ locales, on: 'pt-BR', profile });
  const page = await rendered(english, english.aboutPage().Page);

  it('is read in English, with no switcher to a Portuguese page that is not there', async () => {
    expect(page.querySelector('h1')?.textContent).toBe('How it is built');
    expect(page.querySelector('nav[aria-label="Language"]')).toBeNull();
    expect((await english.aboutPage().generateMetadata()).alternates).toEqual({
      canonical: '/about-this-site',
    });
  });

  it('is not found in Portuguese, nor listed or linked there', async () => {
    await expect(portuguese.aboutPage().Page()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    const urls = portuguese.sitemap().map(({ url }) => url);
    expect(urls).toContain('https://ada.example/about-this-site');
    expect(urls).not.toContain('https://ada.example/pt/about-this-site');
    const home = await rendered(portuguese, portuguese.HomePage);
    expect(hrefsIn(home)).not.toContain('/pt/about-this-site');
  });
});
