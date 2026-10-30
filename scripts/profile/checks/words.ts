import { compileLocaleCopy, type CompileOptions } from '../../../src/core/assistant/copy/compile';
import { ASSISTANT_LIMITS } from '../../../src/core/assistant/copy/limits';
import { CopyError } from '../../../src/core/assistant/copy/prepare';
import { TemplateError } from '../../../src/core/assistant/copy/template';
import type { LanguageAnswers } from '../../../src/core/assistant/system1/fast-path';
import type { Locale, Translations } from '../../../src/core/i18n/locale';
import { localize } from '../../../src/core/knowledge/localize';
import type { ProfileData } from '../../../src/profile/schema';

/**
 * A profile's copy compiled over its record, in every published language, as
 * the site reads it. The checks that ask what the words do — which questions
 * they suggest, which actions the calibration may name — read them from here,
 * so the compiling happens once.
 */

export type Words = Translations<LanguageAnswers>;

/**
 * How a profile's copy is compiled, wherever it is compiled. The copy check
 * and this module must agree on it to the letter: options that differ make
 * one of them compile copy the other cannot, and a check that cannot compile
 * the words does not run at all.
 */
export function compileOptionsFor(data: ProfileData, locale: Locale): CompileOptions {
  const { sourceRepository } = data.identity;
  return {
    locale,
    limits: ASSISTANT_LIMITS,
    // What the about page may say of the site itself: `{{identity.sourceRepository}}`.
    identity: sourceRepository ? { sourceRepository } : {},
  };
}

/**
 * Null where the copy does not compile or render, or a published language has
 * none: the copy and translations checks report those, and there is nothing
 * for the checks built on the words to say until they are fixed.
 */
export function compileWords(data: ProfileData): Words | null {
  try {
    return eachLanguage(data);
  } catch (error) {
    if (error instanceof CopyError || error instanceof TemplateError) return null;
    throw error;
  }
}

function eachLanguage(data: ProfileData): Words | null {
  const languages: Partial<Record<Locale, LanguageAnswers>> = {};
  for (const locale of data.locales) {
    const documents = data.copy[locale];
    if (!documents) return null;
    languages[locale] = {
      knowledge: localize(data.knowledge, locale),
      answers: compileLocaleCopy(documents, compileOptionsFor(data, locale)).answers,
    };
  }
  const english = languages.en;
  return english ? { ...languages, en: english } : null;
}
