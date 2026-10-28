import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { workspaceProps } from '../../../workspace-props';
import { SCENARIOS } from './scenarios';

// The design's full-screen boards, each a known state of the real workspace,
// for the fidelity gate. A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

interface ScenarioPageProps {
  readonly params: Promise<{ readonly scenario: string }>;
}

export default function ScenarioPage({ params }: ScenarioPageProps) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense>
      <Scenario params={params} />
    </Suspense>
  );
}

async function Scenario({ params }: ScenarioPageProps) {
  // Each scenario mints fresh message ids, so it renders per request, not at build.
  await connection();
  const { scenario } = await params;
  const build = SCENARIOS[scenario];
  if (!build) notFound();
  const { conversation, drawerOpen } = build();
  return (
    <ChatWorkspace
      {...workspaceProps()}
      topic={conversation.topic}
      initialConversation={conversation}
      initialDrawerOpen={drawerOpen}
    />
  );
}
