import { interpolate } from '@/core/i18n/format';
import { englishUiMessages } from '../i18n/en';
import { PageFailed } from './page-failed';

interface LayoutFailedProps {
  readonly error: unknown;
  readonly retry: () => void;
  /** Who the site is about, for the tab's title. */
  readonly name: string;
}

const { pageFailed } = englishUiMessages;

/**
 * The failure shown in place of the root layout. With no layout to hand it the
 * page's catalog, it speaks the default English one.
 */
export function LayoutFailed({ error, retry, name }: LayoutFailedProps) {
  return (
    <>
      <title>{interpolate(pageFailed.documentTitle, { name })}</title>
      <PageFailed error={error} retry={retry} messages={pageFailed} />
    </>
  );
}
