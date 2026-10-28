import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { profile } from '@/profile';
import { ABOUT_PATH, aboutMetadata, type AboutPageCopy } from './about-page';
import { siteMessages } from './site-messages';

const about: AboutPageCopy = {
  label: 'About this site',
  title: 'How this site is built',
  description: 'How this site is built and what it runs on.',
  markdown: '## The stack\n\nPlain TypeScript.',
};

describe('the page about the site', () => {
  const knowledge = localize(profile.knowledge, 'en');
  const copy = siteMessages(knowledge, profile.copy.en).site;

  it('is shared as an article at its own address, with the site image', () => {
    const metadata = aboutMetadata(about, copy, knowledge.profile.name);

    expect(metadata.description).toBe(about.description);
    expect(metadata.alternates?.canonical).toBe(ABOUT_PATH);
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      url: ABOUT_PATH,
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
