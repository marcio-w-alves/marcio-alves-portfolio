import type { ReactNode } from 'react';
import type { TopicId } from '@/core/assistant/topics';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { ConversationsProvider } from '@/ui/chat/conversation-store';
import { iconImage } from './icon';
import { loadImageFonts, type ImageFonts } from './image-fonts';
import { homeMetadata, rootMetadata, topicMetadata } from './metadata';
import { robots } from './robots';
import { shareImage, shareImageAlt } from './share-image';
import { createSiteContent } from './site-content';
import type { SiteProfile } from './site-profile';
import { sitemap } from './sitemap';
import { personStructuredData, serializeStructuredData } from './structured-data';
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

  function RootLayout({ children }: { readonly children: ReactNode }) {
    return (
      <html lang="en" className={fontClassName}>
        <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
          <ConversationsProvider>{children}</ConversationsProvider>
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
            __html: serializeStructuredData(personStructuredData(knowledge, siteUrl())),
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
      return <ChatWorkspace {...workspaceView(content, topic)} />;
    }
    return { metadata: topicMetadata(content, topic), Page: TopicPage };
  }

  return {
    rootMetadata: () => rootMetadata(knowledge, siteUrl()),
    RootLayout,
    homeMetadata,
    HomePage,
    topicPage,
    sitemap: () => sitemap(siteUrl()),
    robots: () => robots(siteUrl()),
    imageFonts: () => loadImageFonts(profile.brand.imageFont),
    icon: (size: ImageSize, fonts: ImageFonts) =>
      iconImage({ initials: knowledge.profile.initials, brand: profile.brand, fonts, size }),
    shareImageAlt: shareImageAlt(knowledge),
    shareImage: (size: ImageSize, fonts: ImageFonts) =>
      shareImage({ knowledge, brand: profile.brand, fonts, host: siteUrl().host, size }),
  };
}
