import { describe, expect, it } from 'vitest';
import { buildFixtureIndex } from '../fixture-index';
import committed from './knowledge-index.json';

describe("the fixture's committed retrieval index", () => {
  it('is the one its record builds (run `pnpm fixture:index` after editing the fixture)', () => {
    expect(committed).toEqual(buildFixtureIndex());
  });
});
