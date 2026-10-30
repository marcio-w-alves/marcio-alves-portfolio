import { checkCopyAlignment, checkLocaleCopy } from '../../../src/core/assistant/copy/check';
import { DEFAULT_LOCALE, type Locale } from '../../../src/core/i18n/locale';
import { recordFigures } from '../../../src/core/knowledge/figures';
import { localize } from '../../../src/core/knowledge/localize';
import type { ProfileData } from '../../../src/profile/schema';
import type { BundleProblem } from '../bundle/problems';
import { compileOptionsFor } from './words';

/**
 * A profile's words, proven over its own record before anything is built from
 * it: every template parses, every fact path and id resolves, no literal
 * states one of the record's figures, every answer renders for every input,
 * and each translation answers what English answers. The rules are the core's
 * (`src/core/assistant/copy/check.ts`); what belongs here is placing each
 * problem in the bundle document it was written in.
 */

/** Said where the core's message does not already say what to do about it. */
const REMEDY = 'write it as profiles/example does';

export function checkCopy(data: ProfileData): BundleProblem[] {
  return data.locales.flatMap((locale) => {
    const documents = data.copy[locale];
    // A published locale with no copy is the translations check's to report.
    if (!documents) return [];
    const problems = checkLocaleCopy(documents, {
      ...compileOptionsFor(data, locale),
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

/** Where a copy problem is, as the copy itself addresses it: `topics.yaml`, `#career.parts[0]`. */
interface Place {
  readonly document?: string;
  readonly at?: string;
  readonly problem: string;
  readonly remedy: string;
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
  return [...found.values()].map(({ document, at, problem, remedy }) => ({
    document: document === undefined ? folder : `${folder}${document}`,
    ...(at === undefined ? {} : { at }),
    problem,
    remedy,
  }));
}

/**
 * The core separates a problem from what to do about it with an em dash, as
 * the bundle's problems do; where it wrote no remedy, the generic one keeps
 * copy from being the one family of problems that says only what is wrong.
 */
function said(message: string): { problem: string; remedy: string } {
  const at = message.lastIndexOf(' — ');
  return at < 0
    ? { problem: message, remedy: REMEDY }
    : { problem: message.slice(0, at), remedy: message.slice(at + ' — '.length) };
}

/**
 * The core writes `answers/career.yaml#career.parts[0].text:1:1: …`, which is
 * the document relative to `copy/<locale>/`, sometimes behind the name of the
 * input it was rendering for. A problem about the copy as a whole names no
 * document and is reported against the folder.
 */
function placeOf(message: string, documents: readonly string[]): Place {
  for (const document of documents) {
    const pointed = message.indexOf(`${document}#`);
    if (pointed >= 0) {
      const rest = message.slice(pointed + document.length + 1);
      const problem = rest.indexOf(': ');
      return {
        document,
        at: rest.slice(0, problem),
        ...said(rest.slice(problem + ': '.length)),
      };
    }
    const named = message.indexOf(`${document}: `);
    if (named >= 0) {
      return { document, ...said(message.slice(named + document.length + ': '.length)) };
    }
  }
  return said(message);
}
