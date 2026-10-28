import { describe, expect, it } from 'vitest';
import { about } from './about';

describe("the owner's page about the site", () => {
  it('has a description short enough not to be cut in search results', () => {
    expect(about.description.length).toBeLessThanOrEqual(160);
  });

  it('is written in sections, each under its own heading', () => {
    expect(about.markdown.match(/^## /gm)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });
});
