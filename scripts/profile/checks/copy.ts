import { checkCopyAlignment, checkLocaleCopy } from '../../../src/core/assistant/copy/check';
import { ASSISTANT_LIMITS } from '../../../src/core/assistant/copy/limits';
import { DEFAULT_LOCALE, type Locale } from '../../../src/core/i18n/locale';
import { recordFigures } from '../../../src/core/knowledge/figures';
import { localize } from '../../../src/core/knowledge/localize';
import type { ProfileData } from '../../../src/profile/schema';
import type { BundleProblem } from '../bundle/problems';

/**
 * A profile's words, proven over its own record before anything is built from
 * it: every template parses, every fact path and id resolves, no literal
 * states one of the record's figures, every answer renders for every input,
 * and each translation answers what English answers. The rules are the core's
 * (`src/core/assistant/copy/check.ts`); what belongs here is placing each
 * problem in the bundle document it was written in.
 */

export function checkCopy(data: ProfileData): BundleProblem[] {
  return data.locales.flatMap((locale) => {
    const documents = data.copy[locale];
    // A published locale with no copy is the translations check's to report.
    if (!documents) return [];
    const problems = checkLocaleCopy(documents, {
      locale,
      limits: ASSISTANT_LIMITS,
      identity: identityStrings(data),
      knowledge: localize(data.knowledge, locale),
      figures: recordFigures(data.knowledge),
    });
    const alignment =
      locale === DEFAULT_LOCALE
        ? []
        : checkCopyAlignment(data.copy[DEFAULT_LOCALE], documents, locale);
    return placeEach([...problems, ...alignment], Object.keys(documents), locale);
  });
}

/** What the about page may say of the site itself: `{{identity.sourceRepository}}`. */
function identityStrings({ identity }: ProfileData): Readonly<Record<string, string>> {
  return identity.sourceRepository ? { sourceRepository: identity.sourceRepository } : {};
}

/** Where a copy problem is, as the copy itself addresses it: `topics.yaml`, `#career.parts[0]`. */
interface Place {
  readonly document?: string;
  readonly at?: string;
  readonly problem: string;
}

/**
 * Each problem in the bundle document it names. The check walks a copy twice
 * — once over every branch, once rendering every answer — so one fault can
 * come back in both passes, worded the same; the owner is told once.
 */
function placeEach(
  messages: readonly string[],
  documents: readonly string[],
  locale: Locale,
): BundleProblem[] {
  const folder = `copy/${locale}/`;
  const found = new Map<string, Place>();
  for (const message of messages) {
    const place = placeOf(message, documents);
    found.set(`${place.document ?? ''}#${place.at ?? ''}: ${place.problem}`, place);
  }
  return [...found.values()].map(({ document, at, problem }) => ({
    document: document === undefined ? folder : `${folder}${document}`,
    ...(at === undefined ? {} : { at }),
    problem,
  }));
}

/**
 * The core writes `answers/career.yaml#career.parts[0].text:1:1: …`, which is
 * the document relative to `copy/<locale>/`, sometimes behind the name of the
 * input it was rendering for. A problem about the copy as a whole names no
 * document and is reported against the folder.
 */
function placeOf(message: string, documents: readonly string[]): Place {
  for (const document of documents) {
    const at = message.indexOf(`${document}#`);
    if (at >= 0) {
      const rest = message.slice(at + document.length + 1);
      const said = rest.indexOf(': ');
      return { document, at: rest.slice(0, said), problem: rest.slice(said + ': '.length) };
    }
    const alone = message.indexOf(`${document}: `);
    if (alone >= 0)
      return { document, problem: message.slice(alone + document.length + ': '.length) };
  }
  return { problem: message };
}
