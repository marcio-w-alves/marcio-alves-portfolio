export const MIN_PASSAGE = 400;
export const MAX_PASSAGE = 900;
export const MIN_KEPT = 80;

export interface PageText {
  readonly url: string;
  readonly paragraphs: readonly string[];
}

export interface PagePassages {
  readonly url: string;
  readonly passages: readonly string[];
}

/**
 * Splits pages into passages for retrieval: sentences merged into passages
 * of 400–900 characters, so each is both specific and self-contained. A
 * passage ends at a sentence's end unless that would leave it under 400
 * characters, and only a page's last passage may come out shorter. A paragraph already
 * seen — a header or footer repeated on every page — counts once, and
 * fragments under 80 characters are dropped. The same pages always give
 * the same passages.
 */
export function chunkPages(pages: readonly PageText[]): PagePassages[] {
  const seen = new Set<string>();
  return pages.map(({ url, paragraphs }) => {
    const fresh = paragraphs.filter((paragraph) => {
      if (seen.has(paragraph)) return false;
      seen.add(paragraph);
      return true;
    });
    return { url, passages: passagesOf(fresh).filter((passage) => passage.length >= MIN_KEPT) };
  });
}

function passagesOf(paragraphs: readonly string[]): string[] {
  const passages: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    sentencesOf(paragraph).forEach((sentence, index) => {
      if (!current) {
        current = sentence;
        return;
      }
      const joined = `${current}${index === 0 ? '\n' : ' '}${sentence}`;
      if (joined.length <= MAX_PASSAGE) {
        current = joined;
      } else if (current.length >= MIN_PASSAGE) {
        passages.push(current);
        current = sentence;
      } else {
        // Too short to stand alone, too long to take the whole sentence: it takes the sentence's start.
        const [full, rest] = cutBetweenWords(joined);
        passages.push(full);
        current = rest;
      }
    });
  }
  return current ? [...passages, current] : passages;
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

/** Its sentences, none longer than a passage: an endless one is cut between words. */
function sentencesOf(paragraph: string): string[] {
  return [...segmenter.segment(paragraph)]
    .map(({ segment }) => segment.trim())
    .filter((sentence) => sentence.length > 0)
    .flatMap(withinLimit);
}

function withinLimit(sentence: string): string[] {
  if (sentence.length <= MAX_PASSAGE) return [sentence];
  const [head, rest] = cutBetweenWords(sentence);
  return [head, ...withinLimit(rest)];
}

/** At most a passage's length, cut at the last space that fits. */
function cutBetweenWords(text: string): [head: string, rest: string] {
  const space = text.lastIndexOf(' ', MAX_PASSAGE);
  const at = space > 0 ? space : MAX_PASSAGE;
  return [text.slice(0, at).trimEnd(), text.slice(at).trim()];
}
