import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Timeline } from '@/ui/rich/timeline';
import { responseKit } from '../../../site-knowledge';

// The design's ExperienceTimeline artboard: the whole career, with Deel open.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function ExperienceTimelineFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const block = responseKit.timeline();
  if (block.component !== 'timeline')
    throw new Error('responseKit.timeline() built another block.');
  return (
    <div className="min-h-screen p-10">
      <Timeline roles={block.props.roles} expanded={['deel']} />
    </div>
  );
}
