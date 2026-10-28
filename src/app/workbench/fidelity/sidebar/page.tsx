import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { workspaceProps } from '../../../workspace-props';
import { SidebarSpecimen } from './sidebar-specimen';

// The design's Sidebar artboard: the sidebar alone, a viewport tall, on ice.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function SidebarFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const { profile, links, topics } = workspaceProps();
  return (
    <div className="h-screen bg-ice">
      <SidebarSpecimen profile={profile} links={links} topics={topics} />
    </div>
  );
}
