import { SUPPORTED_LOCALES, isLocale, type Locale } from '../core/i18n/locale';

/** What a build is told about the languages it previews and where it is deployed. */
export interface PublicationEnv {
  readonly [name: string]: string | undefined;
  /**
   * Languages to build beside the profile's own, comma-separated, such as
   * `pt-BR`: how a language is tried — by the end-to-end tests, or by a
   * forker reading a translation — before the profile publishes it. Where a
   * text is not translated yet, it reads in English.
   */
  readonly PREVIEW_LOCALES?: string | undefined;
  /** Set by Vercel: `production` for the public site. */
  readonly VERCEL_ENV?: string | undefined;
}

function previewed(value: string): readonly Locale[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      if (!isLocale(tag)) {
        throw new Error(
          `PREVIEW_LOCALES names "${tag}"; the supported languages are ${SUPPORTED_LOCALES.join(', ')}.`,
        );
      }
      return tag;
    });
}

/**
 * The languages this build serves: the profile's, plus any previewed. A
 * preview never reaches the public site, so a production deployment with
 * one set fails to build rather than publish a language half-written.
 */
export function publishedLocales(
  profileLocales: readonly Locale[],
  { PREVIEW_LOCALES = '', VERCEL_ENV }: PublicationEnv,
): readonly Locale[] {
  const preview = previewed(PREVIEW_LOCALES);
  if (preview.length > 0 && VERCEL_ENV === 'production') {
    throw new Error('PREVIEW_LOCALES is for trying a language out; unset it for production.');
  }
  return SUPPORTED_LOCALES.filter(
    (locale) => profileLocales.includes(locale) || preview.includes(locale),
  );
}
