import { describe, expect, it } from 'vitest';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import { localize } from '@/core/knowledge/localize';
import { profile } from '@/profile';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { homeMetadata, rootMetadata, topicMetadata } from './metadata';
import { createSiteContent } from './site-content';

describe('rootMetadata', () => {
  const metadata = rootMetadata(localize(fixtureKnowledge, 'en'), new URL('https://ada.example'));

  it('names the site after the person in the record, at the canonical address', () => {
    expect(String(metadata.metadataBase)).toBe('https://ada.example/');
    expect(metadata.title).toBe('Ada Rivera — Principal Platform Engineer');
    expect(metadata.description).toBe(
      'Portfolio of Ada Rivera, Principal Platform Engineer. Ask its AI assistant about his documented experience.',
    );
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      siteName: 'Ada Rivera',
      title: metadata.title,
      description: metadata.description,
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: metadata.title });
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
  // The topics' labels and introductions are still written for the owner's record.
  const content = createSiteContent(profile.knowledge, profile.copy.en.answers);

  it.each(TOPIC_IDS.filter((id) => id !== 'overview'))(
    'titles the %s page with its topic and points it at its own address',
    (id) => {
      const topic = content.topicCatalog.topicById(id);

      const metadata = topicMetadata(content, id);

      expect(metadata.title).toBe(`${topic.label} — ${content.knowledge.profile.name}`);
      expect(metadata.description).toBe(topic.description);
      expect(metadata.alternates?.canonical).toBe(`/${id}`);
    },
  );

  it.each(TOPIC_IDS)('keeps the %s description short enough not to be cut in results', (id) => {
    const { description } = content.topicCatalog.topicById(id);
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  // A page's openGraph replaces the root's, so a topic page that left out the
  // image was shared with none.
  it.each(TOPIC_IDS.filter((id) => id !== 'overview'))(
    'shares the %s page with the large card, its own address and the site image',
    (id) => {
      const metadata = topicMetadata(content, id);

      expect(metadata.openGraph).toMatchObject({
        type: 'website',
        siteName: content.knowledge.profile.name,
        url: `/${id}`,
        title: metadata.title,
        description: metadata.description,
        images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
      });
      expect(metadata.twitter).toMatchObject({
        card: 'summary_large_image',
        images: [{ url: '/opengraph-image' }],
      });
    },
  );
});
