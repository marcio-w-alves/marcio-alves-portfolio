import { describe, expect, it } from 'vitest';
import { detectLanguage } from '@/core/assistant/language';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import { localize } from '@/core/knowledge/localize';
import { siteSourceId } from '@/core/knowledge/product-sites';
import { answers } from '../copy/en/answers';
import { answers as portugueseAnswers } from '../copy/pt-BR/answers';
import { knowledge } from '../knowledge';
import { evaluation } from './cases';

describe('the evaluation cases', () => {
  it('give every case a distinct id', () => {
    const ids = evaluation.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('say, for every injection case, what a hijacked answer would contain', () => {
    const injections = evaluation.filter(({ category }) => category === 'injection');
    expect(injections.length).toBeGreaterThan(0);
    for (const { id, expect: expectation } of injections) {
      expect(expectation.avoids ?? [], id).not.toHaveLength(0);
    }
  });

  it('cover leadership and the line between his products and his own work', () => {
    const categories = new Set(evaluation.map(({ category }) => category));
    expect(categories).toContain('leadership');
    expect(categories).toContain('product-vs-person');
  });

  it('declare which path answers every leadership and product-vs-person case', () => {
    const scoped = evaluation.filter(({ category }) =>
      ['leadership', 'product-vs-person'].includes(category),
    );
    for (const { id, expect: expectation } of scoped) expect(expectation.path, id).toBeDefined();
  });

  it('ask about leadership in English and in Portuguese', () => {
    const languages = evaluation
      .filter(({ category }) => category === 'leadership')
      .map(({ expect: expectation }) => expectation.language ?? 'en');
    expect(new Set(languages)).toEqual(new Set(['en', 'pt']));
  });

  it('expect only site pages the snapshot holds to be cited', () => {
    const pages = new Set(knowledge.productSites.map(({ url }) => siteSourceId(url)));
    const cited = evaluation.flatMap(({ expect: expectation }) => expectation.cites ?? []);
    expect(cited.length).toBeGreaterThan(0);
    for (const id of cited.filter((source) => source.startsWith('site:'))) {
      expect(pages, id).toContain(id);
    }
  });

  it('route every case that declares a path to it, on the page it is asked on', () => {
    const fastPath = createFastPath({
      en: { knowledge: localize(knowledge, 'en'), answers },
      'pt-BR': { knowledge: localize(knowledge, 'pt-BR'), answers: portugueseAnswers },
    });
    const fresh = { topic: 'overview', lastIntent: null, ctaShown: false } as const;
    const declared = evaluation.filter(({ expect: expectation }) => expectation.path);
    for (const { id, question, pageLocale = 'en', expect: expectation } of declared) {
      const answered = fastPath.answer(question, fresh, pageLocale).kind === 'answered';
      expect(answered ? 'fast' : 'model', id).toBe(expectation.path);
    }
  });

  it('measure the model on product-vs-person questions too, not only the fast path', () => {
    const cases = evaluation.filter(({ category }) => category === 'product-vs-person');
    expect(cases.some(({ expect: expectation }) => expectation.path === 'model')).toBe(true);
  });

  it('ask about his career, his leadership and his products in Portuguese', () => {
    for (const category of ['career', 'leadership', 'product-vs-person'] as const) {
      const portuguese = evaluation.filter(
        (testCase) => testCase.category === category && testCase.expect.language === 'pt',
      );
      expect(portuguese.length, category).toBeGreaterThan(0);
    }
  });

  it('hold the model to the question’s language over the page’s, and to the page’s on a tie', () => {
    const language = evaluation.filter(
      ({ category, expect: expectation }) =>
        category === 'language' && expectation.path === 'model',
    );
    const portugueseOnEnglish = language.filter(
      ({ question, pageLocale = 'en', expect: expectation }) =>
        pageLocale === 'en' &&
        detectLanguage(question) === 'pt-BR' &&
        expectation.language === 'pt',
    );
    const tieOnPortuguese = language.filter(
      ({ question, pageLocale, expect: expectation }) =>
        pageLocale === 'pt-BR' &&
        detectLanguage(question) === 'ambiguous' &&
        expectation.language === 'pt',
    );
    expect(portugueseOnEnglish.length).toBeGreaterThan(0);
    expect(tieOnPortuguese.length).toBeGreaterThan(0);
  });
});
