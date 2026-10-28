import { formatPeriod } from '../i18n/format';
import type { Locale } from '../i18n/locale';
import type { Knowledge, KnowledgeSource, Role, RoleSource } from './schema';
import { isLocalized } from './translations';

/** How each language says a role is still held, after its start date. */
const ONGOING: Readonly<Record<Locale, string>> = { en: 'Present', 'pt-BR': 'atual' };

/**
 * The record as one locale reads it: every `Localized` text becomes that
 * locale's text — the English one where it is not translated yet — each
 * role's dates are written out in that locale, and everything written once —
 * ids, values, URLs, names — is kept as it is.
 */
export function localize(source: KnowledgeSource, locale: Locale): Knowledge {
  const knowledge = localizeValue(source, locale) as Omit<Knowledge, 'experience'>;
  return {
    ...knowledge,
    experience: source.experience.map((role) => ({
      ...(localizeValue(role, locale) as Omit<Role, 'period'>),
      period: periodOf(role, locale),
    })),
  };
}

function periodOf({ start, end }: RoleSource, locale: Locale): string {
  return formatPeriod(start, end, locale, ONGOING[locale]);
}

function localizeValue(value: unknown, locale: Locale): unknown {
  if (Array.isArray(value)) return value.map((item) => localizeValue(item, locale));
  if (value === null || typeof value !== 'object') return value;
  if (isLocalized(value)) return value[locale] ?? value.en;
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, localizeValue(field, locale)]),
  );
}
