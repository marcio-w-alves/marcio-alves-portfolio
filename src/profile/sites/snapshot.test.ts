import { describe, expect, it } from 'vitest';
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
});
