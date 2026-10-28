'use client';

import { useState } from 'react';
import { topicById, type TopicId } from '@/core/assistant/topics';
import { createConversation, selectTopic } from '@/core/conversation/conversation';
import type { Conversation } from '@/core/conversation/messages';
import { AppShell } from '../shell/app-shell';
import { ConversationTopBar } from '../shell/conversation-top-bar';
import {
  Sidebar,
  type SidebarLinks,
  type SidebarProfile,
  type SidebarTopic,
} from '../shell/sidebar';

interface ChatWorkspaceProps {
  readonly profile: SidebarProfile;
  readonly links: SidebarLinks;
  readonly topics: readonly SidebarTopic[];
}

/** Owns the conversation and hands plain data and callbacks to the presentational parts. */
export function ChatWorkspace({ profile, links, topics }: ChatWorkspaceProps) {
  const [conversation, setConversation] = useState<Conversation>(() => createConversation());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [status, setStatus] = useState('');

  const pickTopic = (topic: TopicId) => {
    setConversation((current) => selectTopic(current, topic));
    setDrawerOpen(false);
  };

  const newConversation = () => {
    setConversation((current) => createConversation(current.topic));
    setDrawerOpen(false);
    setStatus('New conversation started');
  };

  const topic = topicById(conversation.topic);
  const inConversation = conversation.messages.length > 0;

  return (
    <AppShell
      profile={profile}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      onNewConversation={newConversation}
      navigation={
        <Sidebar
          profile={profile}
          topics={topics}
          activeTopic={conversation.topic}
          links={links}
          onPickTopic={pickTopic}
          onNewConversation={newConversation}
          onClose={() => {
            setDrawerOpen(false);
          }}
        />
      }
    >
      {inConversation && (
        <>
          <h1 className="sr-only">Conversation with Marcio&apos;s portfolio assistant</h1>
          <ConversationTopBar topic={topic} onNewConversation={newConversation} />
        </>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" />
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </AppShell>
  );
}
