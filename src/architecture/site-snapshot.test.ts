import { describe, expect, it } from 'vitest';
import { cruiseRepository } from '@/testing/dependency-graph';

describe('the product-site snapshot', () => {
  it('is read only by the profile, which hands it to the rest as part of the record', async () => {
    const { result } = await cruiseRepository();
    const importers = result.modules
      .filter(({ source }) => !/\.test\.tsx?$/.test(source))
      .filter(({ dependencies }) =>
        dependencies.some(({ resolved }) => resolved === 'src/profile/sites/snapshot.json'),
      )
      .map(({ source }) => source);
    expect(importers).toEqual(['src/profile/knowledge/index.ts']);
  });
});
