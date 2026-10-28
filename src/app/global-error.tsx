'use client';

import type { ErrorInfo } from 'next/error';
import { LayoutFailed } from '@/ui/status/layout-failed';
import { fontClassName } from '@/profile/fonts';
import { globalErrorSubject } from '@/profile/global-error-copy';
import '@/ui/globals.css';

/** Replaces the root layout when it is the layout itself that failed, so it brings its own document. */
export default function GlobalError({ error, retry }: ErrorInfo) {
  return (
    <html lang="en" className={fontClassName}>
      <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
        <LayoutFailed error={error} retry={retry} name={globalErrorSubject.name} />
      </body>
    </html>
  );
}
