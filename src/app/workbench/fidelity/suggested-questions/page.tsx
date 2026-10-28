import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { topicCatalog } from '../../../site-knowledge';
import { SuggestionsSpecimen } from './suggestions-specimen';

// The design's SuggestedQuestions artboard: the overview's first four
// suggestions as chips, under a visible title.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function SuggestedQuestionsFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-screen p-10">
      <SuggestionsSpecimen
        questions={topicCatalog.suggestedQuestions('overview', 0, 4).map(({ question, short }) => ({
          question,
          label: short,
        }))}
      />
    </div>
  );
}
