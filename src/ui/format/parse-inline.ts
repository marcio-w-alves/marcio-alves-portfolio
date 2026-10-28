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

const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const WEB_HREF = /^https?:/i;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href);
}

export function parseInline(source: string): InlineNode[] {
  return source
    .split(INLINE_TOKEN)
    .filter((chunk) => chunk !== '')
    .map(toNode);
}

function toNode(chunk: string): InlineNode {
  if (chunk.length > 4 && chunk.startsWith('**') && chunk.endsWith('**')) {
    return { kind: 'strong', text: chunk.slice(2, -2) };
  }
  if (chunk.length > 2 && chunk.startsWith('`') && chunk.endsWith('`')) {
    return { kind: 'code', text: chunk.slice(1, -1) };
  }
  const link = LINK.exec(chunk);
  if (link?.[1] && link[2] && isSafeHref(link[2])) {
    return { kind: 'link', text: link[1], href: link[2], external: WEB_HREF.test(link[2]) };
  }
  return plainText(chunk);
}

// A stray `**` that did not pair up is noise, not content.
function plainText(chunk: string): InlineNode {
  return { kind: 'text', text: chunk.replace(/\*\*/g, '') };
}
