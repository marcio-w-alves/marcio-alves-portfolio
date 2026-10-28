'use client';

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ErrorInfo } from 'next/error';
import { PageFailed } from '@/ui/status/page-failed';
import './globals.css';

/** Replaces the root layout when it is the layout itself that failed, so it brings its own document. */
export default function GlobalError({ error, retry }: ErrorInfo) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-bg font-sans text-ink antialiased">
        <title>Something went wrong — Marcio Alves</title>
        <PageFailed error={error} retry={retry} />
      </body>
    </html>
  );
}
