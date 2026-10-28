import { describe, expect, it } from 'vitest';
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
});
