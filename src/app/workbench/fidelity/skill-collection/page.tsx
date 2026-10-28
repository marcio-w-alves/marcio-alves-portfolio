import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Skills } from '@/ui/rich/skills';
import { responseKit } from '../../../site-knowledge';

// The design's SkillCollection artboard: every skill group.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function SkillCollectionFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const block = responseKit.skills();
  if (block.component !== 'skills') throw new Error('responseKit.skills() built another block.');
  return (
    <div className="min-h-screen p-10">
      <Skills groups={block.props.groups} />
    </div>
  );
}
