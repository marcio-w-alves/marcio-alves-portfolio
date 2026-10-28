import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { WelcomeScreen } from '@/ui/welcome';

// The design's WelcomeScreen artboard: the greeting on its own.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function WelcomeScreenFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-screen p-10">
      <WelcomeScreen welcome={knowledgeBase.welcome} />
    </div>
  );
}
