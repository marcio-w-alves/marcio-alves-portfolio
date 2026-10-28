import { describe, expect, it } from 'vitest';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import type { Locale } from '@/core/i18n/locale';
import { ABOUT_PAGE, type SitePage } from './routes';
import { sitemap } from './sitemap';

const SITE = new URL('https://ada.example');

function pagesBy(entries: [Locale, readonly SitePage[]][]) {
  return new Map(entries);
}

describe('the sitemap', () => {
  it('lists every page at the canonical origin, the overview as the home page, and nothing else while only English is published', () => {
    const entries = sitemap(SITE, pagesBy([['en', TOPIC_IDS]]));

    expect(entries.map(({ url }) => url)).toEqual([
      'https://ada.example/',
      'https://ada.example/experience',
      'https://ada.example/skills',
      'https://ada.example/projects',
      'https://ada.example/philosophy',
      'https://ada.example/education',
    ]);
    expect(entries.some((entry) => 'alternates' in entry)).toBe(false);
  });

  it('lists every page in each published language, each with the page in both', () => {
    const entries = sitemap(
      SITE,
      pagesBy([
        ['en', TOPIC_IDS],
        ['pt-BR', TOPIC_IDS],
      ]),
    );

    expect(entries).toHaveLength(12);
    expect(entries.find(({ url }) => url === 'https://ada.example/pt/skills')).toEqual({
      url: 'https://ada.example/pt/skills',
      alternates: {
        languages: {
          en: 'https://ada.example/skills',
          'pt-BR': 'https://ada.example/pt/skills',
        },
      },
    });
  });

  it('lists a page beside the topics only in the languages that have it, with no alternate it lacks', () => {
    const entries = sitemap(
      SITE,
      pagesBy([
        ['en', [...TOPIC_IDS, ABOUT_PAGE]],
        ['pt-BR', TOPIC_IDS],
      ]),
    );

    expect(entries.find(({ url }) => url.endsWith('/about-this-site'))).toEqual({
      url: 'https://ada.example/about-this-site',
    });
    expect(entries.map(({ url }) => url)).not.toContain('https://ada.example/pt/about-this-site');
  });
});
