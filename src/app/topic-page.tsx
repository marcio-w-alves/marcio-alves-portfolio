import type { Metadata } from 'next';
import type { TopicId } from '@/core/assistant/topics';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { knowledge, topicCatalog } from './site-knowledge';
import { topicPath } from './topic-routes';
import { workspaceProps } from './workspace-props';

/**
 * Each topic has a route folder of its own rather than one dynamic segment:
 * the set of pages is fixed, so the router itself answers 404 for anything
 * else, before any rendering starts.
 */
export function topicMetadata(id: TopicId): Metadata {
  const topic = topicCatalog.topicById(id);
  const title = `${topic.label} — ${knowledge.profile.name}`;
  return {
    title,
    description: topic.intro,
    alternates: { canonical: topicPath(id) },
    openGraph: { title, description: topic.intro },
    twitter: { title, description: topic.intro },
  };
}

export function TopicPage({ topic }: { readonly topic: TopicId }) {
  return <ChatWorkspace {...workspaceProps(topic)} />;
}
