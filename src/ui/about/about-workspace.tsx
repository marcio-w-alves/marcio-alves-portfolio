'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { AppShell } from '../shell/app-shell';
import type { LocaleLink } from '../shell/locale-switch';
import {
  Sidebar,
  type SidebarLinks,
  type SidebarPage,
  type SidebarProfile,
  type SidebarTopic,
} from '../shell/sidebar';

interface AboutWorkspaceProps {
  readonly profile: SidebarProfile;
  readonly links: SidebarLinks;
  readonly topics: readonly SidebarTopic[];
  readonly pages: readonly SidebarPage[];
  /** The page shown, among `pages`. */
  readonly activePage: string;
  /** The home page of this page's language, where conversations live. */
  readonly home: string;
  /** This page in each language that has it; empty while only one does. */
  readonly languages: readonly LocaleLink[];
  readonly children: ReactNode;
}

/**
 * The site's frame around a page that is read, not talked to: the same
 * sidebar, with the page itself where the conversation would be. Starting a
 * conversation from here goes to the home page, where conversations live.
 */
export function AboutWorkspace({
  profile,
  links,
  topics,
  pages,
  activePage,
  home,
  languages,
  children,
}: AboutWorkspaceProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const startConversation = () => {
    router.push(home);
  };
  return (
    <AppShell
      profile={profile}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      onNewConversation={startConversation}
      navigation={
        <Sidebar
          profile={profile}
          topics={topics}
          activeTopic={null}
          pages={pages}
          activePage={activePage}
          links={links}
          languages={languages}
          onNewConversation={startConversation}
          onClose={() => {
            setDrawerOpen(false);
          }}
        />
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </AppShell>
  );
}
