import { DEFAULT_LOCALE, type Locale } from '../../../src/core/i18n/locale';
import { recordTranslationIssues, type ProfileData } from '../../../src/profile/schema';
import type { BundleProblem } from '../bundle/problems';
import { problemAt } from './schema';

/**
 * Every published language says what English says: each text of the record
 * written, with the same figures, and its copy made of the same documents and
 * answers as the English copy.
 */
export function checkTranslations(data: ProfileData): BundleProblem[] {
  return [
    ...recordTranslationIssues(data).map((issue) =>
      problemAt(issue, 'write the translation, stating exactly the figures its English text does'),
    ),
    ...copyParityProblems(data),
  ];
}

function topLevelKeys(value: unknown): string[] {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value)
    : [];
}

function copyParityProblems({ locales, copy }: ProfileData): BundleProblem[] {
  const english = copy.en;
  return locales
    .filter((locale): locale is Exclude<Locale, 'en'> => locale !== DEFAULT_LOCALE)
    .flatMap((locale) => {
      const translated = copy[locale];
      if (!translated) return [];
      const names = new Set([...Object.keys(english), ...Object.keys(translated)]);
      return [...names].flatMap((name) => {
        const document = `copy/${locale}/${name}`;
        if (!(name in english)) {
          return [
            {
              document,
              problem: `has no English twin (copy/${DEFAULT_LOCALE}/${name})`,
              remedy: 'write it in English first, or remove it',
            },
          ];
        }
        if (!(name in translated)) {
          return [
            { document, problem: 'is missing', remedy: `translate copy/${DEFAULT_LOCALE}/${name}` },
          ];
        }
        const keys = new Set(topLevelKeys(translated[name]));
        const englishKeys = new Set(topLevelKeys(english[name]));
        return [
          ...[...englishKeys]
            .filter((key) => !keys.has(key))
            .map((key) => ({
              document,
              at: `/${key}`,
              problem: `"${key}" is missing`,
              remedy: `translate it from copy/${DEFAULT_LOCALE}/${name}`,
            })),
          ...[...keys]
            .filter((key) => !englishKeys.has(key))
            .map((key) => ({
              document,
              at: `/${key}`,
              problem: `"${key}" is not in the English copy`,
              remedy: 'write it in English first, or remove it',
            })),
        ];
      });
    });
}
