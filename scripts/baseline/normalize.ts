/**
 * The only differences between two builds a comparison ignores, each with
 * the reason it is noise rather than content. Anything not listed here is a
 * difference: a change that only looks harmless is still reported, and the
 * owner decides on it (NFR-10).
 */

export interface Normalization {
  readonly id: string;
  readonly reason: string;
}

/** An element left out of the comparison altogether. */
export interface Removal extends Normalization {
  readonly removes: (element: Element) => boolean;
}

/** A pattern rewritten to a placeholder in every attribute value, text and token. */
export interface Rewrite extends Normalization {
  readonly pattern: RegExp;
  readonly replacement: string;
}

const relOf = (element: Element) => (element.getAttribute('rel') ?? '').split(/\s+/);

export const REMOVALS: readonly Removal[] = [
  {
    id: 'runtime-scripts',
    reason:
      "Next's runtime chunks, the streamed RSC payload and the theme bootstrap: they carry build " +
      'ids and chunk hashes, and everything they render is compared as the document, the tokens ' +
      'and the screenshots. Structured data (application/ld+json) is content and stays.',
    removes: (element) =>
      element.tagName === 'SCRIPT' && element.getAttribute('type') !== 'application/ld+json',
  },
  {
    id: 'resource-links',
    reason:
      'Preload, modulepreload and stylesheet links name hashed build files; what those files ' +
      'do to the page is compared through the computed tokens and the screenshots.',
    removes: (element) =>
      element.tagName === 'LINK' &&
      relOf(element).some((rel) => ['preload', 'modulepreload', 'stylesheet'].includes(rel)),
  },
];

export const REWRITES: readonly Rewrite[] = [
  {
    id: 'next-static-path',
    reason:
      'JavaScript and CSS chunks under /_next/static/chunks/ and /css/ are named by hashes of ' +
      'the build, which change whenever any code does; their effect on the page is compared ' +
      'through the tokens and the screenshots. Media files are not: their names hash their ' +
      'own content, so a changed name is a changed file.',
    pattern: /\/_next\/static\/(chunks|css)\/[^\s"'(),]+/g,
    replacement: '/_next/static/$1/<build-file>',
  },
  {
    id: 'next-build-id',
    reason: 'The folder named after the build id (/_next/static/<build-id>/) changes every build.',
    pattern: /\/_next\/static\/(?!(?:chunks|css|media)\/)[^/\s"'(),]+\//g,
    replacement: '/_next/static/<build-id>/',
  },
  {
    id: 'deployment-id',
    reason: "Vercel's ?dpl= query pins assets to one deployment; it changes with every deploy.",
    pattern: /\bdpl=[^&#\s"'(),]+/g,
    replacement: 'dpl=<deployment>',
  },
  {
    id: 'next-font-class',
    reason:
      "next/font's generated class names (__variable_<hash>, __className_<hash>) hash the font " +
      'options and its version; the faces they apply are compared as tokens and pixels.',
    pattern: /\b__(variable|className)_[0-9a-f]+\b/g,
    replacement: '__$1_<hash>',
  },
  {
    id: 'turbopack-font-class',
    reason:
      'The same class names as Turbopack writes them (<hash>_variable, <hash>_className), a ' +
      'leading underscore added when the hash starts with a digit.',
    pattern: /(?<![\w-])_?[A-Za-z0-9]{6}_(variable|className)(?![\w-])/g,
    replacement: '<hash>_$1',
  },
  {
    id: 'icon-cache-key',
    reason:
      'The query on the icon links is a cache-busting key Next generates at build; the ' +
      'images themselves are compared byte for byte as the /icon and /apple-icon routes.',
    pattern: /\/(icon|apple-icon)\?[0-9a-f]{16}\b/g,
    replacement: '/$1?<cache-key>',
  },
];

export const NORMALIZATIONS: readonly Normalization[] = [...REMOVALS, ...REWRITES];

export function normalizeText(text: string): string {
  return REWRITES.reduce(
    (current, { pattern, replacement }) => current.replace(pattern, replacement),
    text,
  );
}

/** Applies every normalization to a document parsed for the comparison. */
export function normalizeDocument(document: Document): void {
  for (const element of Array.from(document.querySelectorAll('*'))) {
    if (REMOVALS.some(({ removes }) => removes(element))) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      attribute.value = normalizeText(attribute.value);
    }
  }
  const walker = document.createTreeWalker(document, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    node.nodeValue = normalizeText(node.nodeValue ?? '');
  }
}
