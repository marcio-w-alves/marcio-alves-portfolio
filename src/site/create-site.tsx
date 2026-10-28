import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { TOPIC_IDS, type TopicId } from '@/core/chat/topic-id';
import { LOCALE_SEGMENT, type Locale } from '@/core/i18n/locale';
import { AboutWorkspace } from '@/ui/about/about-workspace';
import { Article } from '@/ui/about/article';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { ConversationsProvider } from '@/ui/chat/conversation-store';
import { I18nProvider } from '@/ui/i18n/i18n-provider';
import { ButtonLink } from '@/ui/primitives';
import type { LocaleLink } from '@/ui/shell/locale-switch';
import { StatusNotice } from '@/ui/status/status-notice';
import { THEME_SCRIPT } from '@/ui/theme/theme';
import { iconImage } from './icon';
import { loadImageFonts, type ImageFonts } from './image-fonts';
import {
  aboutMetadata,
  homeMetadata,
  rootMetadata,
  SHARE_IMAGE,
  SHARE_IMAGE_SIZE,
  topicMetadata,
} from './metadata';
import { robots } from './robots';
import { ABOUT_PAGE, assetPath, localeFromSegment, pagePath, type SitePage } from './routes';
import { shareImage } from './share-image';
import { createSiteContent } from './site-content';
import { siteMessages } from './site-messages';
import { copyIn, type SiteProfile } from './site-profile';
import { sitemap } from './sitemap';
import {
  homeStructuredData,
  serializeStructuredData,
  topicStructuredData,
} from './structured-data';
import { workspaceView } from './workspace-view';

interface SiteOptions {
  /** The class that defines the font variables on the document. */
  readonly fontClassName: string;
  /** The canonical origin, read when a page or image needs it. */
  readonly siteUrl: () => URL;
  /** The languages this build serves; English is always one of them. */
  readonly locales: readonly Locale[];
  /** The first segment of the address being rendered, `en` for an unprefixed one. */
  readonly localeSegment: () => Promise<string>;
}

interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The pages, built from a profile. The route files under `src/app` only
 * re-export what this returns, so any profile that validates renders a site,
 * in each language the build serves.
 */
export function createSite(profile: SiteProfile, options: SiteOptions) {
  const { fontClassName, siteUrl, locales } = options;
  const built = new Map<Locale, ReturnType<typeof language>>();

  function language(locale: Locale) {
    const copy = copyIn(profile, locale);
    const { about } = copy;
    const content = createSiteContent(profile.knowledge, copy.answers, locale, about);
    return { locale, about, content, messages: siteMessages(content.knowledge, copy, locale) };
  }

  function languageOf(locale: Locale) {
    const found = built.get(locale) ?? language(locale);
    built.set(locale, found);
    return found;
  }

  /** The language a segment serves; any other segment has no pages. */
  function languageAt(segment: string) {
    const locale = localeFromSegment(segment, locales);
    if (!locale) notFound();
    return languageOf(locale);
  }

  async function currentLanguage() {
    return languageAt(await options.localeSegment());
  }

  /** The pages a language has: every topic, and the page about the site where its copy writes one. */
  function pagesOf(locale: Locale): readonly SitePage[] {
    return languageOf(locale).about ? [...TOPIC_IDS, ABOUT_PAGE] : TOPIC_IDS;
  }

  function localesHaving(page: SitePage): readonly Locale[] {
    return locales.filter((locale) => pagesOf(locale).includes(page));
  }

  /**
   * The page in every language that has it, for the switcher; none while only
   * one does, so the switcher never leads to a page that is not there.
   */
  function localeLinks(page: SitePage): readonly LocaleLink[] {
    const having = localesHaving(page);
    if (having.length < 2) return [];
    return having.map((locale) => ({
      locale,
      href: pagePath(locale, page),
      ...languageOf(locale).messages.ui.language,
    }));
  }

  async function RootLayout({ children }: { readonly children: ReactNode }) {
    const { locale, messages } = await currentLanguage();
    return (
      // The theme script sets data-theme before React hydrates, so the
      // attribute differs from the server's by design.
      <html lang={locale} className={fontClassName} suppressHydrationWarning>
        {/* The App Router's root layout owns <head>; next/head is the Pages Router's. */}
        {/* eslint-disable-next-line @next/next/no-head-element */}
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        </head>
        <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
          <I18nProvider locale={locale} messages={messages.ui}>
            <ConversationsProvider>{children}</ConversationsProvider>
          </I18nProvider>
        </body>
      </html>
    );
  }

  function absolute(path: string): URL {
    return new URL(path, siteUrl());
  }

  // Keyed by language and topic: the router keeps a page's component when only
  // the language segment changes, and a draft, an open drawer or a half-typed
  // answer belong to the page they were on.
  function workspace(locale: Locale, topic: TopicId) {
    const { content } = languageOf(locale);
    return (
      <ChatWorkspace
        key={`${locale}:${topic}`}
        {...workspaceView(content, topic)}
        languages={localeLinks(topic)}
      />
    );
  }

  async function HomePage() {
    const { locale, content } = await currentLanguage();
    const home = {
      url: absolute(pagePath(locale, 'overview')),
      locale,
      image: absolute(assetPath(locale, SHARE_IMAGE)),
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(homeStructuredData(content.knowledge, home)),
          }}
        />
        {workspace(locale, 'overview')}
      </>
    );
  }

  /**
   * Each topic has a route folder of its own rather than one dynamic segment:
   * the set of pages is fixed, so the router itself answers 404 for anything
   * else, before any rendering starts.
   */
  function topicPage(topic: TopicId) {
    async function TopicPage() {
      const { locale, content } = await currentLanguage();
      const { label } = content.topicCatalog.topicById(topic);
      const crumbs = topicStructuredData(
        content.knowledge,
        absolute(pagePath(locale, 'overview')),
        label,
        absolute(pagePath(locale, topic)),
      );
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeStructuredData(crumbs) }}
          />
          {workspace(locale, topic)}
        </>
      );
    }
    async function generateMetadata() {
      const { content, messages } = await currentLanguage();
      return topicMetadata(content, messages.site, topic, locales);
    }
    return { generateMetadata, Page: TopicPage };
  }

  /** The page about the site itself, in the languages whose copy writes one. */
  function aboutPage() {
    async function AboutPage() {
      const { locale, content, about } = await currentLanguage();
      if (!about) notFound();
      const view = workspaceView(content);
      const crumbs = topicStructuredData(
        content.knowledge,
        absolute(pagePath(locale, 'overview')),
        about.label,
        absolute(pagePath(locale, ABOUT_PAGE)),
      );
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeStructuredData(crumbs) }}
          />
          <AboutWorkspace
            key={`${locale}:${ABOUT_PAGE}`}
            profile={view.profile}
            links={view.links}
            topics={view.topics}
            pages={view.pages}
            activePage={pagePath(locale, ABOUT_PAGE)}
            home={pagePath(locale, 'overview')}
            languages={localeLinks(ABOUT_PAGE)}
          >
            <Article title={about.title} markdown={about.markdown} />
          </AboutWorkspace>
        </>
      );
    }
    async function generateMetadata() {
      const { locale, content, messages, about } = await currentLanguage();
      if (!about) return {};
      return aboutMetadata(about, messages.site, {
        siteName: content.knowledge.profile.name,
        locale,
        locales: localesHaving(ABOUT_PAGE),
      });
    }
    return { generateMetadata, Page: AboutPage };
  }

  async function NotFound() {
    const { locale, messages } = await currentLanguage();
    const { notFound: copy } = messages.site;
    return (
      <StatusNotice title={copy.title} description={copy.description}>
        <ButtonLink variant="primary" href={pagePath(locale, 'overview')}>
          {copy.home}
        </ButtonLink>
      </StatusNotice>
    );
  }

  const english = () => languageOf('en').content.knowledge;

  return {
    /** Every language the build serves, prerendered. */
    localeParams: () => locales.map((locale) => ({ locale: LOCALE_SEGMENT[locale] })),
    rootMetadata: async () => {
      const { locale, content, messages } = await currentLanguage();
      return rootMetadata(content.knowledge, messages.site, siteUrl(), locale);
    },
    // The browser's own chrome, on phones, takes the page's background.
    viewport: {
      themeColor: [
        { media: '(prefers-color-scheme: light)', color: profile.brand.colors.bg },
        { media: '(prefers-color-scheme: dark)', color: profile.brand.darkColors.bg },
      ],
    },
    RootLayout,
    homeMetadata: async () => homeMetadata((await currentLanguage()).locale, locales),
    HomePage,
    topicPage,
    aboutPage,
    NotFound,
    sitemap: () => sitemap(siteUrl(), new Map(locales.map((locale) => [locale, pagesOf(locale)]))),
    robots: () => robots(siteUrl()),
    imageFonts: () => loadImageFonts(profile.brand.imageFont),
    icon: (size: ImageSize, fonts: ImageFonts) =>
      iconImage({ initials: english().profile.initials, brand: profile.brand, fonts, size }),
    // Full-bleed: iOS rounds the home-screen icon's corners itself.
    appleIcon: (size: ImageSize, fonts: ImageFonts) =>
      iconImage({
        initials: english().profile.initials,
        brand: profile.brand,
        fonts,
        size,
        radius: 0,
      }),
    /** The share card of the language a segment serves. */
    shareImage: (segment: string, fonts: ImageFonts) =>
      shareImage({
        knowledge: languageAt(segment).content.knowledge,
        brand: profile.brand,
        fonts,
        host: siteUrl().host,
        size: SHARE_IMAGE_SIZE,
      }),
  };
}
