'use client';

import {
  Sidebar,
  type SidebarLinks,
  type SidebarProfile,
  type SidebarTopic,
} from '@/ui/shell/sidebar';

interface SidebarSpecimenProps {
  readonly profile: SidebarProfile;
  readonly links: SidebarLinks;
  readonly topics: readonly SidebarTopic[];
}

/** The sidebar on its own artboard, as it reads on the home page. */
export function SidebarSpecimen({ profile, links, topics }: SidebarSpecimenProps) {
  return (
    <Sidebar
      profile={profile}
      topics={topics}
      activeTopic="overview"
      links={links}
      onNewConversation={() => undefined}
      onClose={() => undefined}
    />
  );
}
