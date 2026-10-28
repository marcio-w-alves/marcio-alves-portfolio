import type { CSSProperties } from 'react';
import type { MetricItem } from '@/core/chat/components';

const STAGGER_MS = 60;

export function Metrics({ items }: { readonly items: readonly MetricItem[] }) {
  return (
    <section aria-label="Key metrics" className="@container/metrics">
      <ul className="grid grid-cols-metrics gap-x-7 gap-y-5 @max-metrics-narrow/metrics:grid-cols-2 @max-metrics-narrow/metrics:gap-x-4 @max-metrics-narrow/metrics:gap-y-4.5">
        {items.map((metric, index) => (
          <li
            key={`${metric.value} ${metric.label}`}
            style={{ '--metric-delay': `${String(index * STAGGER_MS)}ms` } as CSSProperties}
            className="flex animate-metric-rise flex-col gap-1.5 pt-3.5 inset-shadow-rule-top-strong"
          >
            {metric.context ? (
              <span className="order-3 text-12 text-ink-muted">{metric.context}</span>
            ) : null}
            <span className="font-display text-32 leading-figure font-normal tracking-display whitespace-nowrap tabular-nums @max-metrics-narrow/metrics:text-27">
              {metric.value}
            </span>
            <span className="text-13 leading-caption text-pretty text-ink">{metric.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
