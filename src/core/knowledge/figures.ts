import type { CalendarDate } from '../i18n/format';

/** What of a record carries its figures; the source and the localized record both have it. */
export interface RecordWithFigures {
  readonly profile: { readonly careerStartYear: number };
  readonly education: { readonly year: number };
  readonly experience: readonly {
    readonly start: CalendarDate;
    readonly end: CalendarDate | null;
  }[];
  readonly metrics: Readonly<Record<string, { readonly value: string }>>;
}

/** The record's own figures — metric values and the years of its dates — that copy must not repeat. */
export function recordFigures({
  profile,
  education,
  experience,
  metrics,
}: RecordWithFigures): string[] {
  const years = [
    profile.careerStartYear,
    education.year,
    ...experience.flatMap(({ start, end }) =>
      [start, end ?? start].map((date) => date.slice(0, 4)),
    ),
  ].map(String);
  return [...new Set([...Object.values(metrics).map((metric) => metric.value), ...years])];
}
