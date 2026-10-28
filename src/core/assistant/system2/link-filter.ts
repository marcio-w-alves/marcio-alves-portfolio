import { scanLink } from '@/core/markdown/markdown-link';

/**
 * Keeps the model from linking anywhere it was not shown. The prompt asks it
 * to link only to addresses from its action results, but third-party text —
 * an encyclopedia extract, a repository description — can carry an address
 * and an instruction to link it. So a Markdown link in the streamed answer
 * stays a link only if its address is allowed; any other becomes its label.
 *
 * Links are read with the grammar the page renders them with, so nothing let
 * through as text can render as a link. Text is passed through as it
 * arrives: only a `[` is held back, until the link it may open closes or
 * turns out not to be one. Code blocks are passed through as written, since
 * the page never renders a link inside one.
 */

export interface LinkFilter {
  /** Takes the next piece of streamed text; returns what can be shown now. */
  push(delta: string): string;
  /** The text still held back once the stream has ended. */
  flush(): string;
}

type Settled =
  | { readonly kind: 'kept'; readonly end: number }
  | { readonly kind: 'not-a-link' }
  | { readonly kind: 'replaced' }
  | { readonly kind: 'held' };

const NOT_A_LINK: Settled = { kind: 'not-a-link' };
const REPLACED: Settled = { kind: 'replaced' };
const HELD: Settled = { kind: 'held' };

const FENCE = '```';

export function createLinkFilter(isAllowed: (url: string) => boolean): LinkFilter {
  let pending = '';
  let streamEnded = false;
  /** The start of the line being shown, enough to tell a code fence. */
  let lineStart = '';
  let inCode = false;

  function track(shown: string): void {
    const lines = shown.split('\n');
    for (const [index, line] of lines.entries()) {
      if (index > 0) {
        if (lineStart.startsWith(FENCE)) inCode = !inCode;
        lineStart = '';
      }
      lineStart = (lineStart + line).trimStart().slice(0, FENCE.length);
    }
  }

  /**
   * Decides the link that may open at `start`. A link whose label or address
   * meets another `[` waits on that one: if it turns out to be a link that is
   * replaced by its label, the outer one is read again.
   */
  function settle(start: number): Settled {
    for (;;) {
      const scan = scanLink(pending, start);
      switch (scan.kind) {
        case 'link':
          if (isAllowed(scan.url)) return { kind: 'kept', end: scan.end };
          pending = pending.slice(0, start) + scan.label + pending.slice(scan.end);
          return REPLACED;
        case 'incomplete':
          return streamEnded ? NOT_A_LINK : HELD;
        case 'not-a-link':
          return NOT_A_LINK;
        case 'bracket': {
          const inner = settle(scan.at);
          if (inner.kind === 'held') return HELD;
          if (inner.kind !== 'replaced') return NOT_A_LINK;
        }
      }
    }
  }

  /** Where the text that needs no decision ends: the next `[` in prose, or the end of a line. */
  function plainEnd(): number | null {
    const lineEnd = pending.indexOf('\n');
    const open = inCode ? -1 : pending.indexOf('[');
    if (open !== -1 && (lineEnd === -1 || open < lineEnd)) return open;
    return lineEnd === -1 ? null : lineEnd + 1;
  }

  function drain(): string {
    let shown = '';
    const release = (length: number) => {
      const text = pending.slice(0, length);
      pending = pending.slice(length);
      track(text);
      shown += text;
    };
    for (;;) {
      const end = plainEnd();
      if (end === null) {
        release(pending.length);
        return shown;
      }
      release(end);
      if (!pending.startsWith('[') || inCode) continue;
      const settled = settle(0);
      if (settled.kind === 'held') return shown;
      if (settled.kind === 'kept') release(settled.end);
      if (settled.kind === 'not-a-link') release(1);
    }
  }

  return {
    push(delta) {
      pending += delta;
      return drain();
    },
    flush() {
      streamEnded = true;
      return drain();
    },
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
