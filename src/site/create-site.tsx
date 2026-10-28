import type { ReactNode } from 'react';
import type { TopicId } from '@/core/chat/topic-id';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { ConversationsProvider } from '@/ui/chat/conversation-store';
import { I18nProvider } from '@/ui/i18n/i18n-provider';
import { ButtonLink } from '@/ui/primitives';
import { StatusNotice } from '@/ui/status/status-notice';
import { iconImage } from './icon';
import { loadImageFonts, type ImageFonts } from './image-fonts';
import { homeMetadata, rootMetadata, topicMetadata } from './metadata';
import { robots } from './robots';
import { shareImage } from './share-image';
import { createSiteContent } from './site-content';
import { siteMessages } from './site-messages';
import type { SiteProfile } from './site-profile';
import { sitemap } from './sitemap';
import { topicPath } from './routes';
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
}

interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The pages, built from a profile. The route files under `src/app` only
 * re-export what this returns, so any profile that validates renders a site.
 */
export function createSite(profile: SiteProfile, { fontClassName, siteUrl }: SiteOptions) {
  const content = createSiteContent(profile.knowledge, profile.copy.en.answers);
  const { knowledge } = content;
  const messages = siteMessages(knowledge, profile.copy.en);

  function RootLayout({ children }: { readonly children: ReactNode }) {
    return (
      <html lang="en" className={fontClassName}>
        <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
          <I18nProvider locale="en" messages={messages.ui}>
            <ConversationsProvider>{children}</ConversationsProvider>
          </I18nProvider>
        </body>
      </html>
    );
  }

  function HomePage() {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(homeStructuredData(knowledge, siteUrl())),
          }}
        />
        <ChatWorkspace {...workspaceView(content)} />
      </>
    );
  }

  /**
   * Each topic has a route folder of its own rather than one dynamic segment:
   * the set of pages is fixed, so the router itself answers 404 for anything
   * else, before any rendering starts.
   */
  function topicPage(topic: TopicId) {
    function TopicPage() {
      const { label } = content.topicCatalog.topicById(topic);
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeStructuredData(
                topicStructuredData(knowledge, siteUrl(), label, topicPath(topic)),
              ),
            }}
          />
          <ChatWorkspace {...workspaceView(content, topic)} />
        </>
      );
    }
    return { metadata: topicMetadata(content, messages.site, topic), Page: TopicPage };
  }

  function NotFound() {
    const { notFound } = messages.site;
    return (
      <StatusNotice title={notFound.title} description={notFound.description}>
        <ButtonLink variant="primary" href="/">
          {notFound.home}
        </ButtonLink>
      </StatusNotice>
    );
  }

  return {
    rootMetadata: () => rootMetadata(knowledge, messages.site, siteUrl()),
    // The browser's own chrome, on phones, takes the page's background.
    viewport: { themeColor: profile.brand.colors.bg },
    RootLayout,
    homeMetadata,
    HomePage,
    topicPage,
    NotFound,
    sitemap: () => sitemap(siteUrl()),
    robots: () => robots(siteUrl()),
    imageFonts: () => loadImageFonts(profile.brand.imageFont),
    icon: (size: ImageSize, fonts: ImageFonts) =>
      iconImage({ initials: knowledge.profile.initials, brand: profile.brand, fonts, size }),
    // Full-bleed: iOS rounds the home-screen icon's corners itself.
    appleIcon: (size: ImageSize, fonts: ImageFonts) =>
      iconImage({
        initials: knowledge.profile.initials,
        brand: profile.brand,
        fonts,
        size,
        radius: 0,
      }),
    shareImageAlt: messages.site.shareImageAlt,
    shareImage: (size: ImageSize, fonts: ImageFonts) =>
      shareImage({ knowledge, brand: profile.brand, fonts, host: siteUrl().host, size }),
  };
}
