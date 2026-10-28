'use client';

import { useState } from 'react';
import type { TopicId } from '@/core/assistant/topics';
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

/** On its own artboard the sidebar keeps a local selection, as the design's does. */
export function SidebarSpecimen({ profile, links, topics }: SidebarSpecimenProps) {
  const [activeTopic, setActiveTopic] = useState<TopicId>('overview');
  return (
    <Sidebar
      profile={profile}
      topics={topics}
      activeTopic={activeTopic}
      links={links}
      onPickTopic={setActiveTopic}
      onNewConversation={() => undefined}
      onClose={() => undefined}
    />
  );
}
