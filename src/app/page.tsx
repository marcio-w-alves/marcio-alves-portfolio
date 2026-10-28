import type { Metadata } from 'next';
import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import { topics } from '@/core/assistant/topics';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';

// Declared on the page rather than the root layout: a canonical inherited by
// every route would point each of them at the home page.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const { profile, contact, welcome } = knowledgeBase;
  return (
    <ChatWorkspace
      profile={{ name: profile.name, title: profile.title, initials: profile.initials }}
      links={contact}
      topics={topics.map(({ id, label, icon }) => ({ id, label, icon }))}
      welcome={welcome}
      maxQuestionLength={MAX_QUESTION_LENGTH}
    />
  );
}
