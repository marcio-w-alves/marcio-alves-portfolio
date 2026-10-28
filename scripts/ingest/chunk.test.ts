import { describe, expect, it } from 'vitest';
import { chunkPages, MAX_PASSAGE, MIN_KEPT, MIN_PASSAGE, type PageText } from './chunk';

/** The passages of a page chunked on its own. */
function passagesOf(page: PageText): readonly string[] {
  return chunkPages([page])[0]?.passages ?? [];
}

function sentence(n: number, length = 120): string {
  const start = `Sentence ${String(n)} says something specific about the product`;
  return (
    `${start}${' and more'.repeat(Math.ceil((length - start.length) / 9))}`.slice(0, length - 1) +
    '.'
  );
}

const LONG_PAGE = {
  url: 'https://pipewright.example/',
  paragraphs: Array.from({ length: 6 }, (_, p) =>
    Array.from({ length: 4 }, (_, s) => sentence(p * 4 + s, 90 + ((p + s) % 4) * 40)).join(' '),
  ),
};

describe('chunking pages into passages', () => {
  it('makes passages of 400–900 characters, the page’s last one excepted', () => {
    const passages = passagesOf(LONG_PAGE);
    expect(passages.length).toBeGreaterThan(2);
    for (const passage of passages.slice(0, -1)) {
      expect(passage.length).toBeGreaterThanOrEqual(MIN_PASSAGE);
      expect(passage.length).toBeLessThanOrEqual(MAX_PASSAGE);
    }
    expect(passages.at(-1)?.length).toBeLessThanOrEqual(MAX_PASSAGE);
  });

  it('ends a passage at the end of a sentence and loses no text', () => {
    const passages = passagesOf(LONG_PAGE);
    for (const passage of passages) expect(passage).toMatch(/\.$/);
    expect(passages.join(' ').replace(/\s+/g, ' ')).toBe(LONG_PAGE.paragraphs.join(' '));
  });

  it('cuts a sentence longer than a passage between words', () => {
    const endless = Array.from({ length: 300 }, (_, i) => `word${String(i)}`).join(' ');
    const passages = passagesOf({ url: 'https://a.example/', paragraphs: [endless] });
    expect(passages.length).toBeGreaterThan(1);
    for (const passage of passages) expect(passage.length).toBeLessThanOrEqual(MAX_PASSAGE);
    expect(passages.join(' ')).toBe(endless);
  });

  it('keeps a paragraph repeated across pages, like a footer, only the first time', () => {
    const footer =
      'Pipewright is made in Porto by a small team that answers every email it receives.';
    const pages = chunkPages([
      { url: 'https://pipewright.example/', paragraphs: [sentence(1, 300), footer] },
      { url: 'https://pipewright.example/about', paragraphs: [sentence(2, 300), footer] },
    ]);
    const all = pages.flatMap(({ passages }) => passages).join('\n');
    expect(all.split(footer)).toHaveLength(2);
    expect(pages[1]?.passages).toEqual([sentence(2, 300)]);
  });

  it(`drops what is left under ${String(MIN_KEPT)} characters`, () => {
    expect(
      passagesOf({ url: 'https://a.example/', paragraphs: ['Sign up today.', 'Pricing.'] }),
    ).toEqual([]);
  });

  it('gives the same passages for the same pages', () => {
    expect(chunkPages([LONG_PAGE])).toEqual(chunkPages([LONG_PAGE]));
  });
});
