import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { workspaceProps } from '../../../workspace-props';
import { SCENARIOS } from './scenarios';

// The design's full-screen boards, each a known state of the real workspace,
// for the fidelity gate. A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

interface ScenarioPageProps {
  readonly params: Promise<{ readonly scenario: string }>;
}

export default async function ScenarioPage({ params }: ScenarioPageProps) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { scenario } = await params;
  const build = SCENARIOS[scenario];
  if (!build) notFound();
  const { conversation, drawerOpen } = build();
  return (
    <ChatWorkspace
      {...workspaceProps()}
      initialConversation={conversation}
      initialDrawerOpen={drawerOpen}
    />
  );
}
