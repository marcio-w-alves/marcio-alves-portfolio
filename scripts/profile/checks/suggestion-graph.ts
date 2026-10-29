import { TemplateError } from '../../../src/core/assistant/copy/template';
import { createFastPath } from '../../../src/core/assistant/system1/fast-path';
import type { Locale } from '../../../src/core/i18n/locale';
import { answerTranscript, suggestedQuestions } from '../../../src/testing/answer-transcript';
import type { BundleProblem } from '../bundle/problems';
import type { Words } from './words';

/**
 * Every question the site offers a visitor — each answer's follow-ups and
 * each topic page's questions, in every published language — is one the fast
 * path answers. A suggestion that escalates spends a model answer on a
 * question the profile already wrote, and with no model configured it offers
 * the visitor nothing but "not documented".
 */

const FRESH = { topic: 'overview', lastIntent: null, ctaShown: false } as const;

export function checkSuggestionGraph(words: Words, locales: readonly Locale[]): BundleProblem[] {
  try {
    return graphProblems(words, locales);
  } catch (error) {
    // Walking the graph renders every answer, and copy that does not render
    // has no graph: the copy check reports that instead.
    if (error instanceof TemplateError) return [];
    throw error;
  }
}

function graphProblems(words: Words, locales: readonly Locale[]): BundleProblem[] {
  const fastPath = createFastPath(words);
  return locales.flatMap((locale) => {
    const language = words[locale];
    if (!language) return [];
    const questions = suggestedQuestions(answerTranscript(language.answers, language.knowledge));
    return questions
      .filter((question) => fastPath.answer(question, FRESH, locale).kind !== 'answered')
      .map((question) => ({
        document: `copy/${locale}/`,
        problem: `the site suggests "${question}", which the fast path does not answer`,
        remedy: 'suggest a question an answer writes, or write the answer it leads to',
      }));
  });
}
