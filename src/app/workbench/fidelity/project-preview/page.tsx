import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Projects } from '@/ui/rich/projects';
import { responseKit } from '../../../site-knowledge';

// The design's ProjectPreview artboard: EvCopilot's card.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function ProjectPreviewFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const block = responseKit.projects(['evcopilot']);
  if (block.component !== 'projects')
    throw new Error('responseKit.projects() built another block.');
  return (
    <div className="min-h-screen p-10">
      <Projects projects={block.props.projects} />
    </div>
  );
}
