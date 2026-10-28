import type { Knowledge, KnowledgeSource, Locale, Localized } from './schema';

/**
 * The record as one locale reads it: every `Localized` text becomes that
 * locale's text, and everything written once — ids, dates, values, URLs,
 * names — is kept as it is.
 */
export function localize(source: KnowledgeSource, locale: Locale): Knowledge {
  return localizeValue(source, locale) as Knowledge;
}

function isLocalized(value: object): value is Localized {
  return 'en' in value && typeof value.en === 'string';
}

function localizeValue(value: unknown, locale: Locale): unknown {
  if (Array.isArray(value)) return value.map((item) => localizeValue(item, locale));
  if (value === null || typeof value !== 'object') return value;
  if (isLocalized(value)) return value[locale];
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, localizeValue(field, locale)]),
  );
}
