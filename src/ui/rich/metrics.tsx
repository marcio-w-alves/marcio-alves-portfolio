import type { CSSProperties } from 'react';
import type { MetricItem } from '@/core/assistant/components';

const STAGGER_MS = 60;

export function Metrics({ items }: { readonly items: readonly MetricItem[] }) {
  return (
    <section aria-label="Key metrics" className="@container/metrics">
      <ul className="grid grid-cols-metrics gap-x-6 gap-y-4.5 @max-metrics-narrow/metrics:grid-cols-2 @max-metrics-narrow/metrics:gap-4">
        {items.map((metric, index) => (
          <li
            key={`${metric.value} ${metric.label}`}
            style={{ '--metric-delay': `${String(index * STAGGER_MS)}ms` } as CSSProperties}
            className="flex animate-metric-rise flex-col gap-1.5 border-t border-border-strong pt-3"
          >
            {metric.context ? (
              <span className="font-mono text-11 leading-label font-medium tracking-caps text-accent uppercase">
                {metric.context}
              </span>
            ) : null}
            <span className="text-30 leading-figure font-medium tracking-figure whitespace-nowrap tabular-nums @max-metrics-narrow/metrics:text-26">
              {metric.value}
            </span>
            <span className="text-13.5 leading-caption text-pretty text-ink-muted">
              {metric.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
