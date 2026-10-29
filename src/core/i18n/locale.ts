/** Every language the site can speak; a profile publishes some of them (`profile.locales`). */
export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** The language every text is written in first, and the one the unprefixed addresses speak. */
export const DEFAULT_LOCALE = 'en' satisfies Locale;

/**
 * Something written in English and, once translated, in the other languages.
 * A language the profile publishes must have its translation (the profile's
 * validation says which are missing); until then a text reads in English.
 */
export type Translations<T> = { readonly en: T } & Partial<
  Readonly<Record<Exclude<Locale, typeof DEFAULT_LOCALE>, T>>
>;

/** Each translation turned into something else, for the same languages. */
export function mapTranslations<T, U>(
  translations: Translations<T>,
  transform: (value: T, locale: Locale) => U,
): Translations<U> {
  const mapped: Partial<Record<Locale, U>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const value = translations[locale];
    if (locale !== DEFAULT_LOCALE && value !== undefined) mapped[locale] = transform(value, locale);
  }
  return { ...mapped, en: transform(translations.en, DEFAULT_LOCALE) };
}

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Each language's first path segment. English pages are served unprefixed;
 * the site's routing rewrites them onto the `en` segment, which never appears
 * in an address the site writes.
 */
export const LOCALE_SEGMENT = { en: 'en', 'pt-BR': 'pt' } as const satisfies Record<Locale, string>;

/**
 * The language an address is written in, by its first segment alone: for
 * where the published set is not known, such as the browser's last-resort
 * error page.
 */
export function localeOfPath(pathname: string): Locale {
  const [, segment = ''] = pathname.split('/');
  return (
    SUPPORTED_LOCALES.find(
      (locale) => locale !== DEFAULT_LOCALE && LOCALE_SEGMENT[locale] === segment,
    ) ?? DEFAULT_LOCALE
  );
}
