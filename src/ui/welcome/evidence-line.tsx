import { useMessages } from '../i18n/i18n-provider';

interface HeadlineMetric {
  readonly value: string;
  readonly label: string;
}

/** The companies and headline metrics that back the greeting, as the record states them. */
export interface Evidence {
  readonly companies: readonly string[];
  readonly metrics: readonly HeadlineMetric[];
}

/** Under the greeting: where the person worked on one line, and what it showed on the next. */
export function EvidenceLine({ evidence }: { readonly evidence: Evidence }) {
  const { welcome } = useMessages();
  return (
    <ul
      aria-label={welcome.evidence}
      className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 text-13 leading-label text-ink-muted"
    >
      <li className="basis-full font-medium text-ink">{evidence.companies.join(' · ')}</li>
      {evidence.metrics.map(({ value, label }) => (
        <li key={label}>
          <span className="font-medium text-ink">{value}</span> {label}
        </li>
      ))}
    </ul>
  );
}
