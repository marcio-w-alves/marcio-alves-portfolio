import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { ComposerSpecimen } from '../../composer/composer-specimen';

// The design's Composer artboard: the welcome composer on its own, idle and empty.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function ComposerFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const { welcome } = knowledgeBase;
  return (
    <div className="min-h-screen p-10">
      <ComposerSpecimen
        variant="hero"
        status="idle"
        placeholder={welcome.placeholder}
        helper={welcome.helper}
        maxLength={MAX_QUESTION_LENGTH}
      />
    </div>
  );
}
