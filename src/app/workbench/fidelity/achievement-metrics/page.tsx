import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { metrics } from '@/core/assistant/response-kit';
import { Metrics } from '@/ui/rich/metrics';

// The design's AchievementMetrics artboard: the six figures it lists, from Deel and Roots.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function AchievementMetricsFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const block = metrics([
    'deel-critical-load',
    'deel-web-vitals',
    'deel-people-list',
    'deel-backlog',
    'roots-team',
    'roots-slack-bot',
  ]);
  if (block.component !== 'metrics') throw new Error('metrics() built another block.');
  return (
    <div className="min-h-screen p-10">
      <Metrics items={block.props.items} />
    </div>
  );
}
