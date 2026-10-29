import { describe, expect, it } from 'vitest';
import { compileLocaleCopy } from '@/core/assistant/copy/compile';
import { createRouter } from '@/core/assistant/system1/router';
import type { Locale } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import { answerTranscript, suggestedQuestions, transcriptDifferences } from '../answer-transcript';
import { exampleCopy } from '../copy-documents';
import { fixtureAnswers, fixturePortugueseAnswers } from './answers';
import {
  fixturePortugueseSiteCopy,
  fixturePortugueseUiCopy,
  fixtureSiteCopy,
  fixtureUiCopy,
} from './copy';
import { fixtureKnowledge } from './knowledge';

/**
 * The example profile's copy, written as data, says exactly what the fixture's
 * TypeScript copy says (AC-21.2): every answer for every input, every topic
 * page, the cards' labels and the router's vocabulary, in each language.
 * Deleted with the TypeScript fixture once the app reads the bundle.
 */

const TS_COPY = {
  en: { answers: fixtureAnswers, ui: fixtureUiCopy, site: fixtureSiteCopy },
  'pt-BR': {
    answers: fixturePortugueseAnswers,
    ui: fixturePortugueseUiCopy,
    site: fixturePortugueseSiteCopy,
  },
} as const;

const LOCALES: readonly Locale[] = ['en', 'pt-BR'];

function compiled(locale: Locale) {
  return compileLocaleCopy(exampleCopy(locale), { locale, limits: {}, identity: {} });
}

describe.each(LOCALES)('the example copy in %s', (locale) => {
  const knowledge = localize(fixtureKnowledge, locale);
  const typescript = TS_COPY[locale];
  const data = () => compiled(locale);

  it('renders every answer and topic exactly as the TypeScript fixture did', () => {
    const expected = answerTranscript(typescript.answers, knowledge);
    const actual = answerTranscript(data().answers, knowledge);
    expect(transcriptDifferences(expected, actual)).toEqual([]);
    expect(actual).toEqual(expected);
  });

  it('routes every question it suggests the same way', () => {
    const questions = suggestedQuestions(answerTranscript(typescript.answers, knowledge));
    const context = { topic: 'overview', lastIntent: null, ctaShown: false } as const;
    const before = createRouter(knowledge, typescript.answers.vocabulary, locale);
    const after = createRouter(knowledge, data().answers.vocabulary, locale);
    // The example suggests six distinct questions; a floor just under that
    // catches a comparison that collapsed to almost nothing.
    expect(questions.length).toBeGreaterThan(5);
    expect(questions.map((question) => after(question, context))).toEqual(
      questions.map((question) => before(question, context)),
    );
  });

  it('words the interface and the pages as before', () => {
    expect(data().ui).toEqual(typescript.ui);
    expect(data().site).toEqual(typescript.site);
    expect(data().about).toBeUndefined();
  });
});
