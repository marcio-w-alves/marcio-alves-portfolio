'use client';

import type { ErrorInfo } from 'next/error';
import { useMessages } from '@/ui/i18n/i18n-provider';
import { PageFailed } from '@/ui/status/page-failed';

export default function ErrorPage({ error, retry }: ErrorInfo) {
  return <PageFailed error={error} retry={retry} messages={useMessages().pageFailed} />;
}
