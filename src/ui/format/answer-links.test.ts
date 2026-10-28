import { describe, expect, it } from 'vitest';
import { createLinkAllowList, createLinkFilter } from '@/core/assistant/system2/link-filter';
import { parseBlocks, type Block } from './parse-blocks';
import type { InlineNode } from './parse-inline';

/**
 * The answer's link filter and the page's renderer, end to end: whatever the
 * model writes, however it streams, the page links only to allowed addresses,
 * and a link that is not a web or mail address stays on this site.
 */

const ALLOWED = 'https://github.com/ada-rivera-example';
const SITE = 'https://site.example';
const allowList = createLinkAllowList([ALLOWED]);

function filtered(answer: string, chunk: number): string {
  const filter = createLinkFilter((url) => allowList.allows(url));
  let shown = '';
  for (let index = 0; index < answer.length; index += chunk) {
    shown += filter.push(answer.slice(index, index + chunk));
  }
  return shown + filter.flush();
}

function withNested(node: InlineNode): readonly InlineNode[] {
  return node.kind === 'strong' ? [node, ...node.children] : [node];
}

function inlineNodes(block: Block): readonly InlineNode[] {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
      return block.content;
    case 'list':
      return block.items.flat();
    case 'code':
      return [];
  }
}

function renderedHrefs(markdown: string): string[] {
  return parseBlocks(markdown)
    .flatMap(inlineNodes)
    .flatMap(withNested)
    .flatMap((node) => (node.kind === 'link' ? [node.href] : []));
}

function unlisted(markdown: string): string[] {
  return renderedHrefs(markdown).filter((href) => !allowList.allows(href));
}

/** Rendered links that are not web or mail addresses but would leave this site. */
function offSite(markdown: string): string[] {
  return renderedHrefs(markdown)
    .filter((href) => !/^(https?|mailto):/i.test(href))
    .filter((href) => new URL(href, SITE).origin !== SITE);
}

const CHUNK_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('links the page renders from a filtered answer', () => {
  it.each([
    ['a label broken by a line', 'See [my\nlabel](https://evil.example) now'],
    ['a label too long to be a link', `[${'a'.repeat(2100)}](https://evil.example)`],
    [
      'a long label with a long address',
      `[${'a'.repeat(2030)}](https://evil.example/${'p'.repeat(40)})`,
    ],
    ['an unlisted link around another', '[a [b](https://evil.one) c](https://evil.two)'],
    ['an allowed link around an unlisted one', `[[x](https://evil.example)](${ALLOWED})`],
    ['an unlisted link inside an allowed one', `[a [b](https://evil.example) c](${ALLOWED})`],
    ['a label that joins an earlier bracket', '[a[x](https://evil.example)](https://evil.two)'],
    ['a link inside an address', '[a](https://evil.example/u[x](https://e.example))'],
    ['a list item continued on the next line', '- [item\n  more](https://evil.example)'],
    ['a link in bold', '**[x](https://evil.example)**'],
    [
      'an allowed and an unlisted link in one bold',
      `**[a](${ALLOWED}) and [b](https://evil.example)**`,
    ],
    ['an unlisted link around a bold one', `[**[x](${ALLOWED})**](https://evil.example)`],
    ['bold that closes inside an address', '**[x](https://evil.example/**)**'],
    ['a bold list item', `1. **[x](https://evil.example)** — [y](${ALLOWED})`],
    [
      'bold that swallows a backtick',
      '**a [x](https://e.example/*)` b** [y](https://evil.example) `',
    ],
    ['a link after a code block', '```\n[x](https://evil.example)\n```\n[y](https://evil.example)'],
    [
      'a label that opens a code block',
      '[```](https://evil.example)\n[x](https://evil.example)\n```',
    ],
    [
      'look-alike addresses',
      '[x](https://github.com@evil.example/ada-rivera-example) [y](//evil.example)',
    ],
    ['paths that name another host', '[x](//evil.example/cv.pdf) [y](/\\evil.example/cv.pdf)'],
  ])('are only allowed ones, whatever the chunk size: %s', (_case, answer) => {
    for (const chunk of CHUNK_SIZES) {
      const shown = filtered(answer, chunk);
      expect(unlisted(shown), `chunk ${String(chunk)}`).toEqual([]);
      expect(offSite(shown), `chunk ${String(chunk)}`).toEqual([]);
    }
  });

  it('are only allowed ones for any mix of Markdown punctuation', () => {
    const pieces = [
      '[',
      ']',
      '(',
      ')',
      ' ',
      '\n',
      'a',
      '`',
      '**',
      '```',
      ALLOWED,
      'https://evil.example',
      '/',
      '//',
      '/\\',
      'evil.example',
      '[a](',
    ];
    let seed = 7;
    const random = (bound: number) => {
      seed = (seed * 48271) % 2147483647;
      return seed % bound;
    };
    for (let sample = 0; sample < 3000; sample += 1) {
      const answer = Array.from(
        { length: 4 + random(30) },
        () => pieces[random(pieces.length)],
      ).join('');
      const shown = filtered(answer, 1 + random(10));
      expect(unlisted(shown), answer).toEqual([]);
      expect(offSite(shown), answer).toEqual([]);
    }
  });

  it('keeps an allowed link a link, however it streams', () => {
    for (const chunk of CHUNK_SIZES) {
      expect(renderedHrefs(filtered(`See [her GitHub](${ALLOWED}).`, chunk))).toEqual([ALLOWED]);
    }
  });

  it('keeps an allowed link in bold a link, and turns an unlisted one into its label', () => {
    const answer = `1. **[her GitHub](${ALLOWED})**\n2. **[elsewhere](https://evil.example)**`;
    for (const chunk of CHUNK_SIZES) {
      const shown = filtered(answer, chunk);
      expect(renderedHrefs(shown)).toEqual([ALLOWED]);
      expect(shown).toContain('**elsewhere**');
    }
  });
});
