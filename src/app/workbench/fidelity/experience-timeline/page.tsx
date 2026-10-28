import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { timeline } from '@/core/assistant/response-kit';
import { Timeline } from '@/ui/rich/timeline';

// The design's ExperienceTimeline artboard: the whole career, with Deel open.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function ExperienceTimelineFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const block = timeline();
  if (block.component !== 'timeline') throw new Error('timeline() built another block.');
  return (
    <div className="min-h-screen p-10">
      <Timeline roles={block.props.roles} expanded={['deel']} />
    </div>
  );
}
