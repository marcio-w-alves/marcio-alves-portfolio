import type { ReactNode } from 'react';

interface StatusNoticeProps {
  readonly title: string;
  readonly description: string;
  /** A short tag above the title, in the danger tone, for pages that report a failure. */
  readonly failure?: string;
  /** What the visitor can do next. */
  readonly children: ReactNode;
}

/** A whole-page notice standing in for content that could not be shown. */
export function StatusNotice({ title, description, failure, children }: StatusNoticeProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6 py-16">
      <section className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-surface p-8">
        {failure ? <p className="text-sm font-medium text-danger">{failure}</p> : null}
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        <p className="text-sm text-ink-muted">{description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
      </section>
    </main>
  );
}
