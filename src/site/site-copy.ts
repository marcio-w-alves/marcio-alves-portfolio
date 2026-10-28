import type { Template } from '@/core/i18n/format';

/**
 * What the pages say about themselves to browsers, search engines and share
 * cards, and the page shown for an address that has none. `{name}`,
 * `{firstName}` and `{title}` name who the site is about.
 */
export interface SiteCopy {
  /** The site's title, which every page without one of its own inherits. */
  readonly title: Template;
  readonly description: Template;
  /** A topic page's title: `{topic}`. */
  readonly topicTitle: Template;
  /** What the share image shows, for readers who cannot see it. */
  readonly shareImageAlt: Template;
  /** The language and region share cards are written for, as Open Graph writes it. */
  readonly openGraphLocale: string;
  readonly notFound: {
    readonly title: string;
    readonly description: string;
    readonly home: string;
  };
}

/** The pages' copy in English, for anyone's portfolio. A profile overrides what it words differently. */
export const englishSiteCopy: SiteCopy = {
  title: '{name} — {title}',
  description:
    'Portfolio of {name}, {title}. Ask its AI assistant about their documented experience.',
  topicTitle: '{topic} — {name}',
  shareImageAlt: '{name}, {title}',
  openGraphLocale: 'en_US',
  notFound: {
    title: 'Page not found',
    description:
      'There is nothing at this address. The link may be mistyped, or the page may have moved.',
    home: 'Go to the home page',
  },
};
