import { describe, expect, it } from 'vitest';
import { parseBlocks } from './parse-blocks';

const text = (value: string) => [{ kind: 'text', text: value }];

describe('answer blocks', () => {
  it('joins wrapped lines into one paragraph and splits paragraphs on blank lines', () => {
    expect(parseBlocks('He led the\nHRIS team.\n\nThen Toptal.')).toEqual([
      { kind: 'paragraph', content: text('He led the HRIS team.') },
      { kind: 'paragraph', content: text('Then Toptal.') },
    ]);
  });

  it('reads ### headings', () => {
    expect(parseBlocks('### Deel\nHRIS.')).toEqual([
      { kind: 'heading', content: text('Deel') },
      { kind: 'paragraph', content: text('HRIS.') },
    ]);
  });

  it('groups bullet and numbered items into separate lists', () => {
    expect(parseBlocks('- React\n- **TypeScript**\n1. First\n2. Second')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [text('React'), [{ kind: 'strong', text: 'TypeScript' }]],
      },
      { kind: 'list', ordered: true, items: [text('First'), text('Second')] },
    ]);
  });

  it('keeps fenced code verbatim, with its language', () => {
    expect(parseBlocks('```tsx\nconst a = **b**;\n  return a;\n```')).toEqual([
      { kind: 'code', language: 'tsx', code: 'const a = **b**;\n  return a;' },
    ]);
  });

  it('shows a fence that is still streaming in', () => {
    expect(parseBlocks('Look:\n```\nconst a')).toEqual([
      { kind: 'paragraph', content: text('Look:') },
      { kind: 'code', language: 'text', code: 'const a' },
    ]);
  });

  it('ends a list when a paragraph follows it', () => {
    expect(parseBlocks('- one\nAfter.')).toEqual([
      { kind: 'list', ordered: false, items: [text('one')] },
      { kind: 'paragraph', content: text('After.') },
    ]);
  });

  it('has nothing to show for empty text', () => {
    expect(parseBlocks('')).toEqual([]);
  });
});
