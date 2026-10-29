import { describe, expect, it } from 'vitest';
import { checkCopyAlignment, checkLocaleCopy } from '@/core/assistant/copy/check';
import { compileLocaleCopy } from '@/core/assistant/copy/compile';
import { ASSISTANT_LIMITS } from '@/core/assistant/copy/limits';
import { createRouter } from '@/core/assistant/system1/router';
import type { Locale } from '@/core/i18n/locale';
import { recordFigures } from '@/core/knowledge/figures';
import { localize } from '@/core/knowledge/localize';
import { answerTranscript, transcriptDifferences } from '@/testing/answer-transcript';
import { ownerCopy, ownerCopyWritten } from '@/testing/copy-documents';
import { REPOSITORY, about } from './copy/en/about';
import { answers } from './copy/en/answers';
import { site } from './copy/en/site';
import { ui } from './copy/en/ui';
import { about as portugueseAbout } from './copy/pt-BR/about';
import { answers as portugueseAnswers } from './copy/pt-BR/answers';
import { site as portugueseSite } from './copy/pt-BR/site';
import { ui as portugueseUi } from './copy/pt-BR/ui';
import { evaluation } from './evaluation/cases';
import { knowledge as source } from './knowledge';
import { locales } from './locales';

/**
 * The owner's copy, written as data, says exactly what his TypeScript copy
 * says (AC-21.1): every answer for every intent, company, project, technology
 * and language, every topic page, the cards' labels, the router's vocabulary,
 * the interface overrides and the about page, in every published language. It
 * compares two owner sources with each other and holds no owner text of its
 * own. Deleted with the TypeScript copy.
 *
 * His copy documents are personal data, so they are not in the repository:
 * they live in his private profile home, written there by
 * `pnpm exec tsx scripts/profile/export-owner-copy.mts`. Without them — CI, a
 * fresh clone — there is nothing to compare and these tests are skipped, so
 * the oracle is real on the machine that has the data and never prints that
 * prose into a public log.
 */

const TS_COPY = {
  en: { answers, ui, site, about },
  'pt-BR': {
    answers: portugueseAnswers,
    ui: portugueseUi,
    site: portugueseSite,
    about: portugueseAbout,
  },
} as const;

const exported = ownerCopyWritten(locales);

function compiled(locale: Locale) {
  return compileLocaleCopy(ownerCopy(locale), {
    locale,
    limits: ASSISTANT_LIMITS,
    identity: { sourceRepository: REPOSITORY },
  });
}

const FRESH = { topic: 'overview', lastIntent: null, ctaShown: false } as const;

function suggestedQuestions(transcript: Readonly<Record<string, unknown>>): string[] {
  return Object.values(transcript).flatMap((entry) => {
    const { followUps = [], questions = [] } = (entry ?? {}) as {
      followUps?: string[];
      questions?: { question: string }[];
    };
    return [...followUps, ...questions.map(({ question }) => question)];
  });
}

describe.skipIf(!exported).each(locales)('the owner copy in %s', (locale) => {
  const knowledge = localize(source, locale);
  const typescript = TS_COPY[locale];
  const data = () => compiled(locale);

  it('renders every answer and topic exactly as the TypeScript copy did', () => {
    const expected = answerTranscript(typescript.answers, knowledge);
    const actual = answerTranscript(data().answers, knowledge);
    expect(transcriptDifferences(expected, actual)).toEqual([]);
    expect(actual).toEqual(expected);
  });

  it('routes every suggested, follow-up and evaluation question the same way', () => {
    const asked = evaluation
      .filter((entry) => (entry.pageLocale ?? 'en') === locale)
      .map((entry) => entry.question);
    const questions = [
      ...new Set([
        ...suggestedQuestions(answerTranscript(typescript.answers, knowledge)),
        ...asked,
      ]),
    ];
    const before = createRouter(knowledge, typescript.answers.vocabulary, locale);
    const after = createRouter(knowledge, data().answers.vocabulary, locale);
    expect(questions.length).toBeGreaterThan(20);
    expect(questions.map((question) => after(question, FRESH))).toEqual(
      questions.map((question) => before(question, FRESH)),
    );
  });

  it('words the interface overrides and the about page as before', () => {
    expect(data().ui).toEqual(typescript.ui);
    expect(data().site).toEqual(typescript.site);
    expect(data().about).toEqual(typescript.about);
  });

  it('passes every check over the record, and says what English says', () => {
    const problems = checkLocaleCopy(ownerCopy(locale), {
      locale,
      limits: ASSISTANT_LIMITS,
      identity: { sourceRepository: REPOSITORY },
      knowledge,
      figures: recordFigures(source),
    });
    const alignment =
      locale === 'en' ? [] : checkCopyAlignment(ownerCopy('en'), ownerCopy(locale), locale);
    expect([...problems, ...alignment]).toEqual([]);
  });
});
