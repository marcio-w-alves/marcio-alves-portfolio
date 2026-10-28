import { describe, expect, it } from 'vitest';
import { excludePattern } from '@/core/knowledge/product-sites';
import { profile } from '..';

const { siteAllowList } = profile;
const { productSites } = profile.knowledge;

describe('the committed site snapshot', () => {
  it('holds only pages the allow-list names, each read on a stated day', () => {
    const allowed = siteAllowList.flatMap(({ urls }) => urls);
    for (const { id, url, fetchedAt } of productSites) {
      expect(allowed, id).toContain(url);
      expect(fetchedAt, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('has passages for every allow-listed page (run `pnpm sites:ingest` after editing the list)', () => {
    const read = new Set(productSites.map(({ url }) => url));
    for (const url of siteAllowList.flatMap(({ urls }) => urls)) expect(read, url).toContain(url);
  });

  it.each([
    ['a founder biography', /Technion|Sarona Ventures|30 Under 30|Paris Saint-Germain/],
    ['conflicting funding and customer figures', /\$600 million|\$650 million|35,000|40,000/],
    ["a client's testimonial", /doubled our client base/],
    ["the site's own error message", /couldn't load the product list/],
  ])('keeps out %s, which is not about the product', (_case, text) => {
    for (const { id, text: passage } of productSites) expect(passage, id).not.toMatch(text);
  });

  it('applies every exclusion the allow-list declares', () => {
    for (const { subject, excludes = [] } of siteAllowList) {
      const passages = productSites.filter((passage) => passage.subject.id === subject.id);
      for (const exclude of excludes) {
        const matches = excludePattern(exclude);
        for (const { id, text } of passages) {
          for (const paragraph of text.split('\n'))
            expect(matches(paragraph), `${id}: ${exclude}`).toBe(false);
        }
      }
    }
  });
});
