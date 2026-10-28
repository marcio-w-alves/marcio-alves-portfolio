import Link from 'next/link';
import { Fragment } from 'react';
import type { Locale } from '@/core/i18n/locale';
import { cn } from '../cn';
import { useLocale, useMessages } from '../i18n/i18n-provider';
import { VisuallyHidden } from '../primitives';

/** The page the visitor is on, in one of the languages the site speaks. */
export interface LocaleLink {
  readonly locale: Locale;
  readonly href: string;
  /** What the switcher shows: `EN`. */
  readonly short: string;
  /** What a screen reader reads, in the language itself: `English`. */
  readonly name: string;
}

/**
 * "EN · PT": the same page in each language, the current one marked. Plain
 * links, so each is a real address a visitor can open, share or bookmark;
 * nothing renders while the site speaks a single language.
 */
export function LocaleSwitch({
  languages,
  className,
}: {
  readonly languages: readonly LocaleLink[];
  readonly className?: string;
}) {
  const { shell } = useMessages();
  const current = useLocale();
  if (languages.length < 2) return null;
  return (
    <nav
      aria-label={shell.language}
      className={cn('flex items-center text-12.5 text-ink-muted', className)}
    >
      {languages.map(({ locale, href, short, name }, index) => (
        <Fragment key={locale}>
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <Link
            href={href}
            hrefLang={locale}
            lang={locale}
            aria-current={locale === current ? 'page' : undefined}
            title={name}
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm no-underline',
              'transition-colors duration-fast ease-standard hover:text-ink',
              locale === current && 'font-medium text-ink',
            )}
          >
            <span aria-hidden="true">{short}</span>
            <VisuallyHidden>{name}</VisuallyHidden>
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
