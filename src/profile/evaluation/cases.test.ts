import { describe, expect, it } from 'vitest';
import { createRouter } from '@/core/assistant/system1/router';
import { localize } from '@/core/knowledge/localize';
import { siteSourceId } from '@/core/knowledge/product-sites';
import { answers } from '../copy/en/answers';
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

  it('route every product-vs-person case to the path it declares', () => {
    const route = createRouter(localize(knowledge, 'en'), answers.vocabulary);
    const fresh = { topic: 'overview', lastIntent: null, ctaShown: false } as const;
    const cases = evaluation.filter(({ category }) => category === 'product-vs-person');
    expect(cases.some(({ expect: expectation }) => expectation.path === 'model')).toBe(true);
    for (const { id, question, expect: expectation } of cases) {
      const escalated = route(question, fresh).intent === 'escalate';
      expect(escalated ? 'model' : 'fast', id).toBe(expectation.path);
    }
  });
});
