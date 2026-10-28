import { describe, expect, it } from 'vitest';
import { parseBlocks } from './parse-blocks';

const text = (value: string) => [{ kind: 'text', text: value }];

describe('answer blocks', () => {
  it('joins wrapped lines into one paragraph and splits paragraphs on blank lines', () => {
    expect(parseBlocks('She led the\npayroll team.\n\nThen Initech.')).toEqual([
      { kind: 'paragraph', content: text('She led the payroll team.') },
      { kind: 'paragraph', content: text('Then Initech.') },
    ]);
  });

  it('reads ### headings', () => {
    expect(parseBlocks('### Acme\npayroll.')).toEqual([
      { kind: 'heading', content: text('Acme') },
      { kind: 'paragraph', content: text('payroll.') },
    ]);
  });

  it('groups bullet and numbered items into separate lists', () => {
    expect(parseBlocks('- React\n- **TypeScript**\n1. First\n2. Second')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [text('React'), [{ kind: 'strong', children: text('TypeScript') }]],
      },
      { kind: 'list', ordered: true, start: 1, items: [text('First'), text('Second')] },
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

  it.each([[''], ['   '], ['\n\n  \n']])('has nothing to show for %j', (markdown) => {
    expect(parseBlocks(markdown)).toEqual([]);
  });

  it.each([
    ['## Two', true],
    ['#### Four', true],
    ['# One', false],
    ['##### Five', false],
    ['###NoSpace', false],
  ])('reads %j as a heading: %s', (line, isHeading) => {
    const [block] = parseBlocks(line);
    expect(block?.kind === 'heading').toBe(isHeading);
  });

  it('lets a heading end the paragraph before it', () => {
    expect(parseBlocks('Intro\n### Acme')).toEqual([
      { kind: 'paragraph', content: text('Intro') },
      { kind: 'heading', content: text('Acme') },
    ]);
  });

  it('reads star and indented bullets as items of one list', () => {
    expect(parseBlocks('* React\n  - Next.js')).toEqual([
      { kind: 'list', ordered: false, items: [text('React'), text('Next.js')] },
    ]);
  });

  it('starts a new list after a blank line', () => {
    expect(parseBlocks('- one\n\n- two')).toEqual([
      { kind: 'list', ordered: false, items: [text('one')] },
      { kind: 'list', ordered: false, items: [text('two')] },
    ]);
  });

  it('keeps counting a numbered list that paragraphs interrupt', () => {
    const blocks = parseBlocks(
      '1. **first-repo**\n\nWhat it does.\n\n2. **second-repo**\n\nAnother.\n\n3. **third-repo**',
    );
    expect(
      blocks.flatMap((block) => (block.kind === 'list' && block.ordered ? block.start : [])),
    ).toEqual([1, 2, 3]);
  });

  it('starts a numbered list at the number its first item carries', () => {
    expect(parseBlocks('4. Fourth\n5. Fifth')).toEqual([
      { kind: 'list', ordered: true, start: 4, items: [text('Fourth'), text('Fifth')] },
    ]);
  });

  it('keeps blank lines and markdown-looking lines inside fenced code', () => {
    expect(parseBlocks('```\n# not a heading\n\n- not a list\n```\nAfter.')).toEqual([
      { kind: 'code', language: 'text', code: '# not a heading\n\n- not a list' },
      { kind: 'paragraph', content: text('After.') },
    ]);
  });

  it('reads text with Windows line endings like any other', () => {
    expect(parseBlocks('### Acme\r\n- payroll\r\n\r\nDone.\r\n')).toEqual([
      { kind: 'heading', content: text('Acme') },
      { kind: 'list', ordered: false, items: [text('payroll')] },
      { kind: 'paragraph', content: text('Done.') },
    ]);
  });
});
