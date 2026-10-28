import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';
import { PageError } from './errors';

export const MIN_READABLE_CHARS = 200;

export interface ReadablePage {
  /** The main content's paragraphs, headings and list items, in order. */
  readonly paragraphs: readonly string[];
  /** The primary subtag of `<html lang>`, such as `pt` for `pt-BR`. */
  readonly language: string;
}

const BLOCKS =
  'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, dt, dd, figcaption, summary';

/**
 * The page's main content as prose, read the way a reader view reads it: the
 * navigation, footers and scripts left out, nothing executed. A page whose
 * text is drawn by JavaScript has almost nothing to read, and is refused
 * rather than stored as a handful of menu labels.
 */
export function extractReadablePage(
  html: string,
  url: string,
  fallbackLanguage: string,
): ReadablePage {
  // The page's own stylesheets and scripts are noise here, never errors worth printing.
  const { document } = new JSDOM(html, { url, virtualConsole: new VirtualConsole() }).window;
  const [declared = ''] = document.documentElement.lang.split('-');
  const language = declared ? declared.toLowerCase() : fallbackLanguage;
  const article = new Readability(document).parse();
  const paragraphs = article?.content ? blocksOf(article.content).filter(isProse) : [];
  const length = paragraphs.join('').length;
  if (length < MIN_READABLE_CHARS) {
    throw new PageError(
      `${url}: only ${String(length)} characters of readable text; it renders client-side, so its static HTML cannot be ingested`,
    );
  }
  return { paragraphs, language };
}

/** The innermost text blocks, so a list item inside a quote is read once. */
function blocksOf(content: string): string[] {
  const { document } = new JSDOM(content).window;
  for (const lineBreak of document.querySelectorAll('br')) lineBreak.replaceWith(' ');
  return [...document.querySelectorAll(BLOCKS)]
    .filter((block) => !block.querySelector(BLOCKS) && !isComposed(block))
    .map((block) => block.textContent.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0);
}

/**
 * A block assembled from separately styled labels, with no words of its own
 * between them: a card of a mock screen ("Série 3 registrada" over "Afundo
 * búlgaro · 12 kg × 10"), a price row, a status chip. Its text is interface,
 * not prose, and read as one line it glues words together.
 */
function isComposed(element: Element): boolean {
  const written = [...element.childNodes].filter((node) => node.textContent?.trim());
  const [only] = written;
  if (written.length === 1 && isElement(only)) return isComposed(only);
  return written.length > 1 && written.every(isElement);
}

function isElement(node: Node | undefined): node is Element {
  return node?.nodeType === 1;
}

const SENTENCE_END = /[.!?…:;]["'”’)]?$/u;
const SHORT_LABEL = 40;

/**
 * Prose, not interface: a sentence, or a heading long enough to say
 * something. Counters, button labels and the figures of a product's mock
 * dashboard ("8,420", "87% resolved by AI") are dropped, so a demo screen's
 * numbers can never be read back as the product's results.
 */
function isProse(text: string): boolean {
  return SENTENCE_END.test(text) || text.length >= SHORT_LABEL;
}
