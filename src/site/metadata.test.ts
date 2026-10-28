import { describe, expect, it } from 'vitest';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import type { Locale } from '@/core/i18n/locale';
import { profile } from '@/profile';
import { fixtureSiteProfile } from '@/testing/fixture-profile';
import { aboutMetadata, homeMetadata, rootMetadata, topicMetadata } from './metadata';
import { createSiteContent } from './site-content';
import { siteMessages } from './site-messages';

const SITE = new URL('https://ada.example');
const ENGLISH_ONLY: readonly Locale[] = ['en'];
const BOTH: readonly Locale[] = ['en', 'pt-BR'];

function pagesIn(locale: Locale) {
  const overrides = locale === 'en' ? fixtureSiteProfile.copy.en : { ui: {}, site: {} };
  const content = createSiteContent(
    fixtureSiteProfile.knowledge,
    fixtureSiteProfile.copy.en.answers,
    locale,
  );
  return { content, copy: siteMessages(content.knowledge, overrides, locale).site };
}

const english = pagesIn('en');
const portuguese = pagesIn('pt-BR');

describe('rootMetadata', () => {
  const metadata = rootMetadata(english.content.knowledge, english.copy, SITE, 'en');

  it('names the site after the person in the record, at the canonical address', () => {
    expect(String(metadata.metadataBase)).toBe('https://ada.example/');
    expect(metadata.title).toBe('Ada Rivera — Principal Platform Engineer');
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      siteName: 'Ada Rivera',
      locale: 'en_US',
      title: metadata.title,
      description: metadata.description,
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: metadata.title });
  });

  it("describes the site in the profile's own words where it has them", () => {
    expect(metadata.description).toBe(
      'Portfolio of Ada Rivera, Principal Platform Engineer. Ask its assistant about her platform work.',
    );
  });

  it('falls back to the default wording where the profile has none of its own', () => {
    const plain = siteMessages(english.content.knowledge, { ui: {}, site: {} }, 'en').site;
    expect(rootMetadata(english.content.knowledge, plain, SITE, 'en').description).toBe(
      'Portfolio of Ada Rivera, Principal Platform Engineer. Ask its AI assistant about their documented experience.',
    );
  });

  it('sets no canonical every page would inherit', () => {
    expect(metadata.alternates).toBeUndefined();
  });

  it("shares every page of a language with that language's own card", () => {
    const pt = rootMetadata(portuguese.content.knowledge, portuguese.copy, SITE, 'pt-BR');

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: '/brand/share-image.png', width: 1200, height: 630 }),
    ]);
    expect(pt.description).toBe(
      'Portfólio de Ada Rivera, Principal Platform Engineer. Pergunte ao assistente de IA sobre a experiência documentada.',
    );
    expect(pt.openGraph).toMatchObject({
      locale: 'pt_BR',
      images: [expect.objectContaining({ url: '/pt/brand/share-image.png' })],
    });
    expect(pt.twitter).toMatchObject({ images: [{ url: '/pt/brand/share-image.png' }] });
  });
});

describe('homeMetadata', () => {
  it('points the home page at itself, and lists no other language while there is none', () => {
    expect(homeMetadata('en', ENGLISH_ONLY).alternates).toEqual({ canonical: '/' });
  });

  it('points each home page at itself and at its counterpart, English standing in for others', () => {
    const languages = { en: '/', 'pt-BR': '/pt', 'x-default': '/' };

    expect(homeMetadata('en', BOTH).alternates).toEqual({ canonical: '/', languages });
    expect(homeMetadata('pt-BR', BOTH).alternates).toEqual({ canonical: '/pt', languages });
  });
});

describe('topicMetadata', () => {
  it.each(TOPIC_IDS.filter((id) => id !== 'overview'))(
    'titles the %s page with its topic and points it at its own address',
    (id) => {
      const topic = english.content.topicCatalog.topicById(id);

      const metadata = topicMetadata(english.content, english.copy, id, ENGLISH_ONLY);

      expect(metadata.title).toBe(`${topic.label} — Ada Rivera`);
      expect(metadata.description).toBe(topic.description);
      expect(metadata.alternates).toEqual({ canonical: `/${id}` });
    },
  );

  it('describes a Portuguese page as itself, beside its English counterpart', () => {
    const metadata = topicMetadata(portuguese.content, portuguese.copy, 'experience', BOTH);

    expect(metadata.alternates).toEqual({
      canonical: '/pt/experience',
      languages: { en: '/experience', 'pt-BR': '/pt/experience', 'x-default': '/experience' },
    });
    expect(metadata.openGraph).toMatchObject({
      locale: 'pt_BR',
      url: '/pt/experience',
      images: [expect.objectContaining({ url: '/pt/brand/share-image.png' })],
    });
  });

  // A property every profile's copy must hold, checked on the profile the site ships.
  const shipped = createSiteContent(profile.knowledge, profile.copy.en.answers, 'en');

  it.each(TOPIC_IDS)('keeps the %s description short enough not to be cut in results', (id) => {
    const { description } = shipped.topicCatalog.topicById(id);
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  // A page's openGraph replaces the root's, so a topic page that left out the
  // image was shared with none.
  it.each(TOPIC_IDS.filter((id) => id !== 'overview'))(
    'shares the %s page with the large card, its own address and the site image',
    (id) => {
      const metadata = topicMetadata(english.content, english.copy, id, ENGLISH_ONLY);

      expect(metadata.openGraph).toMatchObject({
        type: 'website',
        siteName: 'Ada Rivera',
        locale: 'en_US',
        url: `/${id}`,
        title: metadata.title,
        description: metadata.description,
        images: [
          {
            url: '/brand/share-image.png',
            width: 1200,
            height: 630,
            type: 'image/png',
            alt: 'Ada Rivera, Principal Platform Engineer',
          },
        ],
      });
      expect(metadata.twitter).toMatchObject({
        card: 'summary_large_image',
        images: [{ url: '/brand/share-image.png' }],
      });
    },
  );
});

describe('aboutMetadata', () => {
  const about = {
    label: 'About this site',
    title: 'How this site is built',
    description: 'How this site is built and what it runs on.',
    markdown: '## The stack\n\nPlain TypeScript.',
  };

  it('is shared as an article at its own address, with the site image', () => {
    const metadata = aboutMetadata(about, english.copy, {
      siteName: 'Ada Rivera',
      locale: 'en',
      locales: ENGLISH_ONLY,
    });

    expect(metadata.description).toBe(about.description);
    expect(metadata.alternates).toEqual({ canonical: '/about-this-site' });
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      url: '/about-this-site',
      images: [{ url: '/brand/share-image.png', width: 1200, height: 630 }],
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('points a Portuguese copy at its English counterpart once both languages have one', () => {
    const metadata = aboutMetadata(about, portuguese.copy, {
      siteName: 'Ada Rivera',
      locale: 'pt-BR',
      locales: BOTH,
    });

    expect(metadata.alternates).toEqual({
      canonical: '/pt/about-this-site',
      languages: {
        en: '/about-this-site',
        'pt-BR': '/pt/about-this-site',
        'x-default': '/about-this-site',
      },
    });
  });
});
