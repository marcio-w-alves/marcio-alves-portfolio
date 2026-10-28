import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Metrics } from '@/ui/rich/metrics';
import { responseKit } from '../../../site-knowledge';

// The design's AchievementMetrics artboard: six figures. Two of the design's own are no
// longer on the résumé (POR-37), so the WEBFI and Maison Moderne ones take their place.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function AchievementMetricsFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const block = responseKit.metrics([
    'deel-critical-load',
    'deel-web-vitals',
    'deel-people-list',
    'roots-team',
    'maison-newsletter',
    'webfi-sales',
  ]);
  if (block.component !== 'metrics') throw new Error('responseKit.metrics() built another block.');
  return (
    <div className="min-h-screen p-10">
      <Metrics items={block.props.items} />
    </div>
  );
}
