'use client';

import type { ErrorInfo } from 'next/error';
import { PageFailed } from '@/ui/status/page-failed';
import { fontVariables } from './fonts';
import './globals.css';

/** Replaces the root layout when it is the layout itself that failed, so it brings its own document. */
export default function GlobalError({ error, retry }: ErrorInfo) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
        <title>Something went wrong — Marcio Alves</title>
        <PageFailed error={error} retry={retry} />
      </body>
    </html>
  );
}
