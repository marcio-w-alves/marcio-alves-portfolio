/**
 * The one definition of a Markdown link, `[label](address)`, shared by the
 * page that renders answers and the filter that decides which links an
 * answer may keep. If the two disagreed, text the filter let through as
 * "not a link" could still render as one.
 *
 * A link lies on one line. Its label holds no brackets, so links never nest.
 * Its address holds no whitespace and no brackets, and at most one level of
 * parentheses, as in https://en.wikipedia.org/wiki/Angular_(web_framework).
 * Both are bounded, so a would-be link is settled within a known distance.
 */

export const MAX_LABEL_LENGTH = 300;
export const MAX_ADDRESS_LENGTH = 2048;

export type LinkScan =
  | { readonly kind: 'link'; readonly end: number; readonly label: string; readonly url: string }
  /** The text ends before the link could close: more text may still make it one. */
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'not-a-link' }
  /** A `[` where the link would continue: whether this is a link depends on what that one becomes. */
  | { readonly kind: 'bracket'; readonly at: number };

const INCOMPLETE: LinkScan = { kind: 'incomplete' };
const NOT_A_LINK: LinkScan = { kind: 'not-a-link' };

/** Reads the link that may open with the `[` at `start`. */
export function scanLink(text: string, start: number): LinkScan {
  const labelEnd = scanLabel(text, start + 1);
  if (typeof labelEnd !== 'number') return labelEnd;
  const open = labelEnd + 1;
  if (open >= text.length) return INCOMPLETE;
  if (text[open] === '[') return { kind: 'bracket', at: open };
  if (text[open] !== '(') return NOT_A_LINK;
  const addressEnd = scanAddress(text, open + 1);
  if (typeof addressEnd !== 'number') return addressEnd;
  return {
    kind: 'link',
    end: addressEnd + 1,
    label: text.slice(start + 1, labelEnd),
    url: text.slice(open + 1, addressEnd),
  };
}

/** Where the label starting at `from` ends, at its `]`. */
function scanLabel(text: string, from: number): number | LinkScan {
  for (let index = from; ; index += 1) {
    if (index - from > MAX_LABEL_LENGTH) return NOT_A_LINK;
    if (index >= text.length) return INCOMPLETE;
    const char = text[index];
    if (char === '[') return { kind: 'bracket', at: index };
    if (char === '\n') return NOT_A_LINK;
    if (char === ']') return index === from ? NOT_A_LINK : index;
  }
}

/** Where the address starting at `from` ends, at its closing `)`. */
function scanAddress(text: string, from: number): number | LinkScan {
  let insideParentheses = false;
  for (let index = from; ; index += 1) {
    if (index - from > MAX_ADDRESS_LENGTH) return NOT_A_LINK;
    if (index >= text.length) return INCOMPLETE;
    const char = text[index] ?? '';
    if (char === '[') return { kind: 'bracket', at: index };
    if (char === ']' || /\s/.test(char)) return NOT_A_LINK;
    if (char === '(') {
      if (insideParentheses) return NOT_A_LINK;
      insideParentheses = true;
    } else if (char === ')') {
      if (!insideParentheses) return index === from ? NOT_A_LINK : index;
      insideParentheses = false;
    }
  }
}
