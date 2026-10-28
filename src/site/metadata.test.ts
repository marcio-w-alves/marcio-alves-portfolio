import { describe, expect, it } from 'vitest';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import { profile } from '@/profile';
import { fixtureSiteProfile } from '@/testing/fixture-profile';
import { homeMetadata, rootMetadata, topicMetadata } from './metadata';
import { createSiteContent } from './site-content';
import { siteMessages } from './site-messages';

const content = createSiteContent(fixtureSiteProfile.knowledge, fixtureSiteProfile.copy.en.answers);
const copy = siteMessages(content.knowledge, fixtureSiteProfile.copy.en).site;

describe('rootMetadata', () => {
  const metadata = rootMetadata(content.knowledge, copy, new URL('https://ada.example'));

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
    const plain = siteMessages(content.knowledge, { ui: {}, site: {} }).site;
    expect(rootMetadata(content.knowledge, plain, new URL('https://ada.example')).description).toBe(
      'Portfolio of Ada Rivera, Principal Platform Engineer. Ask its AI assistant about their documented experience.',
    );
  });

  it('sets no canonical every page would inherit', () => {
    expect(metadata.alternates).toBeUndefined();
  });
});

describe('homeMetadata', () => {
  it('points the home page at itself', () => {
    expect(homeMetadata.alternates?.canonical).toBe('/');
  });
});

describe('topicMetadata', () => {
  it.each(TOPIC_IDS.filter((id) => id !== 'overview'))(
    'titles the %s page with its topic and points it at its own address',
    (id) => {
      const topic = content.topicCatalog.topicById(id);

      const metadata = topicMetadata(content, copy, id);

      expect(metadata.title).toBe(`${topic.label} — Ada Rivera`);
      expect(metadata.description).toBe(topic.description);
      expect(metadata.alternates?.canonical).toBe(`/${id}`);
    },
  );

  // A property every profile's copy must hold, checked on the profile the site ships.
  const shipped = createSiteContent(profile.knowledge, profile.copy.en.answers);

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
      const metadata = topicMetadata(content, copy, id);

      expect(metadata.openGraph).toMatchObject({
        type: 'website',
        siteName: 'Ada Rivera',
        locale: 'en_US',
        url: `/${id}`,
        title: metadata.title,
        description: metadata.description,
        images: [
          {
            url: '/opengraph-image',
            width: 1200,
            height: 630,
            alt: 'Ada Rivera, Principal Platform Engineer',
          },
        ],
      });
      expect(metadata.twitter).toMatchObject({
        card: 'summary_large_image',
        images: [{ url: '/opengraph-image' }],
      });
    },
  );
});
