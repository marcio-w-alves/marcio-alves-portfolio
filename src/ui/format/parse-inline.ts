import { scanLink } from '@/core/markdown/markdown-link';

/**
 * The inline Markdown subset an answer may use — `**bold**`, `` `code` `` and
 * `[label](https://…)` — parsed into plain data. Nothing here produces markup:
 * the renderer turns each node into a text node inside a fixed element, so
 * text from a model cannot inject HTML.
 */

export type InlineNode =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | {
      readonly kind: 'link';
      readonly text: string;
      readonly href: string;
      /** An http(s) link leaves the site; a mailto link does not. */
      readonly external: boolean;
    };

const STRONG = /\*\*[^*\n]+\*\*/y;
const CODE = /`[^`\n]+`/y;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const WEB_HREF = /^https?:/i;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href);
}

/**
 * Reads left to right; at each position bold, then code, then a link may
 * start. Links follow the grammar the answer's link filter applies.
 */
export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let text = '';
  let index = 0;
  const keepText = () => {
    if (text) nodes.push(plainText(text));
    text = '';
  };
  while (index < source.length) {
    const token = tokenAt(source, index);
    if (token) {
      if (token.node.kind === 'text') {
        text += token.node.text;
      } else {
        keepText();
        nodes.push(token.node);
      }
      index = token.end;
    } else {
      text += source.charAt(index);
      index += 1;
    }
  }
  keepText();
  return nodes;
}

function tokenAt(source: string, index: number): { node: InlineNode; end: number } | null {
  const strong = matchAt(STRONG, source, index);
  if (strong) return { node: { kind: 'strong', text: strong.slice(2, -2) }, end: STRONG.lastIndex };
  const code = matchAt(CODE, source, index);
  if (code) return { node: { kind: 'code', text: code.slice(1, -1) }, end: CODE.lastIndex };
  if (source[index] !== '[') return null;
  const link = scanLink(source, index);
  if (link.kind !== 'link') return null;
  const node: InlineNode = isSafeHref(link.url)
    ? { kind: 'link', text: link.label, href: link.url, external: WEB_HREF.test(link.url) }
    : { kind: 'text', text: source.slice(index, link.end) };
  return { node, end: link.end };
}

function matchAt(pattern: RegExp, source: string, index: number): string | null {
  pattern.lastIndex = index;
  return pattern.exec(source)?.[0] ?? null;
}

// A stray `**` that did not pair up is noise, not content.
function plainText(text: string): InlineNode {
  return { kind: 'text', text: text.replace(/\*\*/g, '') };
}
