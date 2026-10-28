import { parseInline, type InlineNode } from './parse-inline';

/**
 * The block-level Markdown subset an answer may use — paragraphs, `###`
 * headings, `-` and `1.` lists, fenced code — parsed into plain data, like the
 * inline subset. A fence still open at the end is kept, so code can be shown
 * while it streams in.
 */

export type Block =
  | { readonly kind: 'paragraph'; readonly content: readonly InlineNode[] }
  | { readonly kind: 'heading'; readonly content: readonly InlineNode[] }
  | {
      readonly kind: 'list';
      readonly ordered: false;
      readonly items: readonly (readonly InlineNode[])[];
    }
  | {
      readonly kind: 'list';
      readonly ordered: true;
      /** The first item's number, so a list a paragraph interrupted keeps counting. */
      readonly start: number;
      readonly items: readonly (readonly InlineNode[])[];
    }
  | { readonly kind: 'code'; readonly language: string; readonly code: string };

const FENCE = /^```\s*([\w-]*)/;
const HEADING = /^#{2,4}\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)\.\s+(.*)$/;

type OpenList =
  | { readonly ordered: false; readonly items: InlineNode[][] }
  | { readonly ordered: true; readonly start: number; readonly items: InlineNode[][] };

interface OpenCode {
  readonly language: string;
  readonly lines: string[];
}

// Formatting never runs across a line, as in the answer's link filter: a link
// split over two lines must not join into one here.
function paragraphContent(lines: readonly string[]): InlineNode[] {
  const nodes: InlineNode[] = [];
  for (const [index, line] of lines.entries()) {
    for (const node of parseInline(index === 0 ? line : ` ${line}`)) {
      const last = nodes.at(-1);
      if (node.kind === 'text' && last?.kind === 'text') {
        nodes[nodes.length - 1] = { kind: 'text', text: last.text + node.text };
      } else {
        nodes.push(node);
      }
    }
  }
  return nodes;
}

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const open: { paragraph: string[]; list: OpenList | null; code: OpenCode | null } = {
    paragraph: [],
    list: null,
    code: null,
  };

  const flushParagraph = () => {
    if (open.paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', content: paragraphContent(open.paragraph) });
    }
    open.paragraph = [];
  };
  const flushList = () => {
    if (open.list) blocks.push({ kind: 'list', ...open.list });
    open.list = null;
  };
  const flushCode = () => {
    if (open.code) {
      blocks.push({
        kind: 'code',
        language: open.code.language,
        code: open.code.lines.join('\n'),
      });
    }
    open.code = null;
  };

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();

    if (open.code) {
      if (line.trim().startsWith('```')) flushCode();
      else open.code.lines.push(rawLine);
      continue;
    }

    const fence = FENCE.exec(line.trim());
    if (fence) {
      flushParagraph();
      flushList();
      open.code = { language: fence[1] ?? '', lines: [] };
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', content: parseInline(heading[1] ?? '') });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      flushParagraph();
      if (open.list?.ordered !== false) flushList();
      open.list ??= { ordered: false, items: [] };
      open.list.items.push(parseInline(bullet[1] ?? ''));
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (numbered) {
      flushParagraph();
      if (open.list?.ordered !== true) flushList();
      open.list ??= { ordered: true, start: Number(numbered[1]), items: [] };
      open.list.items.push(parseInline(numbered[2] ?? ''));
      continue;
    }

    flushList();
    open.paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();
  return blocks;
}
