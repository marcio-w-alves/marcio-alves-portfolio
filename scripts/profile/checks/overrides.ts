import type { Locale } from '../../../src/core/i18n/locale';
import { DEFAULT_MESSAGES } from '../../../src/site/site-messages';
import type { ProfileData } from '../../../src/profile/schema';
import { pointer, type BundleProblem } from '../bundle/problems';

/**
 * Where a profile words the interface and the pages its own way, it must word
 * something that is there: a message the default catalog has, in the shape it
 * has it. An override of a name the catalog does not know is dropped in
 * silence when the catalogs are merged, and one that puts a group where a
 * message belongs reaches the browser as the wrong kind of text.
 */

type Group = Readonly<Record<string, unknown>>;

const CATALOGS = {
  'ui.yaml': {
    of: (locale: Locale): Group => ({ ...DEFAULT_MESSAGES[locale].ui }),
    // One module per language, so a problem points at the one to read.
    source: (locale: Locale) => `src/ui/i18n/${locale}.ts`,
  },
  'site.yaml': {
    of: (locale: Locale): Group => ({ ...DEFAULT_MESSAGES[locale].site }),
    source: () => 'src/site/site-copy.ts',
  },
} as const;

export function checkOverrides(data: ProfileData): BundleProblem[] {
  return data.locales.flatMap((locale) => {
    const documents = data.copy[locale] ?? {};
    return Object.entries(CATALOGS).flatMap(([name, catalog]) => {
      const written = documents[name];
      if (written === undefined) return [];
      const document = `copy/${locale}/${name}`;
      const remedy = `word one of the default messages (${catalog.source(locale)})`;
      if (!isGroup(written)) {
        return [{ document, problem: `is ${kindOf(written)}, not a group of messages`, remedy }];
      }
      return overrideProblems({ document, remedy }, catalog.of(locale), written, []);
    });
  });
}

interface Where {
  readonly document: string;
  readonly remedy: string;
}

function isGroup(value: unknown): value is Group {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function kindOf(value: unknown): string {
  if (typeof value === 'string') return 'a message';
  if (Array.isArray(value)) return 'a list';
  if (isGroup(value)) return 'a group of messages';
  return `a ${typeof value}`;
}

function overrideProblems(
  where: Where,
  defaults: Group,
  written: Group,
  path: readonly string[],
): BundleProblem[] {
  return Object.entries(written).flatMap(([key, value]) => {
    const at = pointer([...path, key]);
    if (!Object.hasOwn(defaults, key)) {
      return [{ ...where, at, problem: `"${key}" is not one of the default messages` }];
    }
    const base = defaults[key];
    if (kindOf(base) !== kindOf(value)) {
      return [
        { ...where, at, problem: `is ${kindOf(value)} where the default is ${kindOf(base)}` },
      ];
    }
    return isGroup(base) && isGroup(value)
      ? overrideProblems(where, base, value, [...path, key])
      : [];
  });
}
