'use client';

import type { ErrorInfo } from 'next/error';
import { usePathname } from 'next/navigation';
import { LayoutFailed } from '@/ui/status/layout-failed';
import { fontClassName } from '@/profile/fonts';
import { globalErrorSubject } from '@/profile/global-error-copy';
import '@/ui/globals.css';

/**
 * Replaces the root layout when it is the layout itself that failed, so it
 * brings its own document, in the language of the address.
 */
export default function GlobalError({ error, retry }: ErrorInfo) {
  return (
    <LayoutFailed
      error={error}
      retry={retry}
      name={globalErrorSubject.name}
      pathname={usePathname()}
      fontClassName={fontClassName}
    />
  );
}
