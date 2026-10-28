import { interpolate } from '@/core/i18n/format';
import { localeOfPath } from '@/core/i18n/locale';
import { DEFAULT_UI_MESSAGES } from '../i18n/defaults';
import { PageFailed } from './page-failed';

interface LayoutFailedProps {
  readonly error: unknown;
  readonly retry: () => void;
  /** Who the site is about, for the tab's title. */
  readonly name: string;
  /** The address that failed, whose language the page speaks. */
  readonly pathname: string;
  /** The class that defines the font variables on the document. */
  readonly fontClassName: string;
}

/**
 * The document shown in place of the root layout. With no layout to hand it
 * the page's catalog, it speaks the default one of the address's language.
 */
export function LayoutFailed({ error, retry, name, pathname, fontClassName }: LayoutFailedProps) {
  const locale = localeOfPath(pathname);
  const { pageFailed } = DEFAULT_UI_MESSAGES[locale];
  return (
    <html lang={locale} className={fontClassName}>
      <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
        <title>{interpolate(pageFailed.documentTitle, { name })}</title>
        <PageFailed error={error} retry={retry} messages={pageFailed} />
      </body>
    </html>
  );
}
