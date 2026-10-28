/**
 * Keeps the model from linking anywhere it was not shown. The prompt asks it
 * to link only to addresses from its action results, but third-party text —
 * an encyclopedia extract, a repository description — can carry an address
 * and an instruction to link it. So a Markdown link in the streamed answer
 * stays a link only if its address is allowed; any other becomes its label.
 *
 * Text is passed through as it arrives. Only a `[` is held back, until the
 * link it may open closes or turns out not to be one.
 */

/** A held `[` that has not closed by then is released as written. */
const MAX_HELD = 2048;

export interface LinkFilter {
  /** Takes the next piece of streamed text; returns what can be shown now. */
  push(delta: string): string;
  /** The text still held back once the stream has ended. */
  flush(): string;
}

type Scan =
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'not-a-link' }
  | {
      readonly kind: 'link';
      readonly length: number;
      readonly label: string;
      readonly url: string;
    };

const INCOMPLETE: Scan = { kind: 'incomplete' };
const NOT_A_LINK: Scan = { kind: 'not-a-link' };

/** Where the label of a link opened at index 0 ends — brackets inside it nest. */
function labelEnd(text: string): number | Scan {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\n') return NOT_A_LINK;
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) return index;
  }
  return INCOMPLETE;
}

/**
 * Where the address opened at `start` ends. It may hold one balanced pair of
 * parentheses, as in https://en.wikipedia.org/wiki/Angular_(web_framework).
 */
function addressEnd(text: string, start: number): number | Scan {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index] ?? '';
    if (/\s/.test(char)) return NOT_A_LINK;
    if (char === '(') depth += 1;
    if (char === ')') {
      if (depth === 0) return index === start ? NOT_A_LINK : index;
      depth -= 1;
    }
  }
  return INCOMPLETE;
}

function scanLink(text: string): Scan {
  const label = labelEnd(text);
  if (typeof label !== 'number') return label;
  if (label + 1 >= text.length) return INCOMPLETE;
  if (text[label + 1] !== '(') return NOT_A_LINK;
  const address = addressEnd(text, label + 2);
  if (typeof address !== 'number') return address;
  return {
    kind: 'link',
    length: address + 1,
    label: text.slice(1, label),
    url: text.slice(label + 2, address),
  };
}

export function createLinkFilter(isAllowed: (url: string) => boolean): LinkFilter {
  let pending = '';

  function shownLink(link: Extract<Scan, { kind: 'link' }>): string {
    return isAllowed(link.url) ? pending.slice(0, link.length) : link.label;
  }

  function drain(streamEnded: boolean): string {
    let shown = '';
    for (;;) {
      const open = pending.indexOf('[');
      if (open === -1) {
        shown += pending;
        pending = '';
        return shown;
      }
      shown += pending.slice(0, open);
      pending = pending.slice(open);

      const scan = scanLink(pending);
      if (scan.kind === 'link') {
        shown += shownLink(scan);
        pending = pending.slice(scan.length);
      } else if (scan.kind === 'incomplete' && !streamEnded && pending.length < MAX_HELD) {
        return shown;
      } else {
        // Not a link after all: the `[` is text, and a link may still follow it.
        shown += '[';
        pending = pending.slice(1);
      }
    }
  }

  return {
    push(delta) {
      pending += delta;
      return drain(false);
    },
    flush: () => drain(true),
  };
}

/** The addresses an answer may link to. */
export interface LinkAllowList {
  allow(url: string): void;
  allows(url: string): boolean;
}

// Compared as the browser would resolve them: scheme and host in any case,
// with or without a trailing slash or a fragment.
function normalized(url: string): string | null {
  if (!URL.canParse(url)) return null;
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.href.replace(/\/(?=$|\?)/, '');
}

export function createLinkAllowList(known: Iterable<string>): LinkAllowList {
  const allowed = new Set<string>();
  const allowList: LinkAllowList = {
    allow(url) {
      const key = normalized(url);
      if (key) allowed.add(key);
    },
    allows(url) {
      const key = normalized(url);
      return key !== null && allowed.has(key);
    },
  };
  for (const url of known) allowList.allow(url);
  return allowList;
}

const ADDRESS = /^(?:https?:\/\/|mailto:)\S+$/i;

/**
 * Every value in `data` that is an address. An address written inside prose
 * is not one: that is where an injected link would hide.
 */
export function urlsIn(data: unknown): string[] {
  if (typeof data === 'string') return ADDRESS.test(data) ? [data] : [];
  if (Array.isArray(data)) return data.flatMap(urlsIn);
  if (data !== null && typeof data === 'object') return Object.values(data).flatMap(urlsIn);
  return [];
}
