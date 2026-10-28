'use client';

import type { ErrorInfo } from 'next/error';
import { PageFailed } from '@/ui/status/page-failed';

export default function ErrorPage({ error, retry }: ErrorInfo) {
  return <PageFailed error={error} retry={retry} />;
}
