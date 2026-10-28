import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { topics } from '@/core/assistant/topics';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { SidebarSpecimen } from './sidebar-specimen';

// The design's Sidebar artboard: the sidebar alone, a viewport tall, on ice.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function SidebarFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const { profile, contact } = knowledgeBase;
  return (
    <div className="h-screen bg-ice">
      <SidebarSpecimen
        profile={{ name: profile.name, title: profile.title }}
        links={contact}
        topics={topics.map(({ id, label, icon }) => ({ id, label, icon }))}
      />
    </div>
  );
}
