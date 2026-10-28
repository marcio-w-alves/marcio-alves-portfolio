import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../i18n/locale';
import type { KnowledgeSource, Localized } from './schema';

/** Where a text sits in the record, e.g. `['experience', 2, 'highlights', 4]`. */
export type TextPath = readonly PropertyKey[];

export function isLocalized(value: object): value is Localized {
  return 'en' in value && typeof value.en === 'string';
}

/** Every `Localized` text of a value, with where it sits. */
function localizedTexts(value: unknown, path: TextPath = []): [TextPath, Localized][] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => localizedTexts(item, [...path, index]));
  }
  if (isLocalized(value)) return [[path, value]];
  return Object.entries(value).flatMap(([key, field]) => localizedTexts(field, [...path, key]));
}

/** The path of every text not written in `locale`, ending in the locale's own key. */
export function untranslated(value: unknown, locale: Locale): TextPath[] {
  return localizedTexts(value)
    .filter(([, text]) => text[locale] === undefined)
    .map(([path]) => [...path, locale]);
}

/** The languages every text of the record is written in: English, and each one translated in full. */
export function writtenLocales(source: KnowledgeSource): readonly Locale[] {
  return SUPPORTED_LOCALES.filter((locale) => untranslated(source, locale).length === 0);
}

const FIGURE = /https?:\/\/[^\s)>\]]+|\d+(?:[.,]\d+)*/g;

/**
 * The numbers, dates and links a text states. A number is compared by its
 * digits alone, so `1.5` and `1,5` or `10,000` and `10.000` — how each
 * language writes the same figure — count as one.
 */
function figures(text: string): Set<string> {
  return new Set(
    [...text.matchAll(FIGURE)].map(([figure]) =>
      figure.startsWith('http') ? figure.replace(/[.,;:]$/, '') : figure.replace(/[.,]/g, ''),
    ),
  );
}

/** A translation states only what its English text does: no figure, date or link of its own. */
export interface AddedFigures {
  readonly path: TextPath;
  readonly figures: readonly string[];
}

/** Each translation into `locale` that states a figure, date or link its English text does not. */
export function addedFigures(value: unknown, locale: Locale): AddedFigures[] {
  if (locale === DEFAULT_LOCALE) return [];
  return localizedTexts(value).flatMap(([path, text]) => {
    const translation = text[locale];
    if (translation === undefined) return [];
    const english = figures(text.en);
    const added = [...figures(translation)].filter((figure) => !english.has(figure));
    return added.length > 0 ? [{ path: [...path, locale], figures: added }] : [];
  });
}
