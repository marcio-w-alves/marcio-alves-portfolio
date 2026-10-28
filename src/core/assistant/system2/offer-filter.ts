/**
 * Removes offers of help ("If you need more details, feel free to ask!") from
 * the model's text as it streams. The prompt forbids them, but the model
 * still writes them; the page already suggests what to ask next, so they
 * only add noise.
 *
 * Text is passed through as it arrives. Only a sentence that begins the way
 * an offer begins is held back until it ends, then dropped if it is one.
 */

const OPENERS = [
  'if you',
  'if there',
  'feel free',
  'let me know',
  "i'm happy",
  'i am happy',
  "i'd be happy",
  'happy to',
  'se precisar',
  'se quiser',
  'se tiver',
  'se você',
  'caso precise',
  'caso queira',
  'caso tenha',
  'fique à vontade',
  'estou à disposição',
  'estou aqui',
  'não hesite',
  'si necesitas',
  'si quieres',
  'si tienes',
  'no dudes',
  'estoy a tu',
  'estoy aquí',
  'quedo a',
];

const OFFER =
  /feel free|let me know|happy to help|just ask|à (?:sua )?disposição|fique à vontade|não hesite|no dudes|a (?:tu|su) disposición|\b(?:ask|questions?|more (?:details|information)|mais (?:informações|detalhes)|pergunt\w*|más (?:información|detalles)|pregunt\w*)\b/i;

/** A sentence ends at terminal punctuation followed by whitespace, or before a line break. */
const BOUNDARY = /[.!?](?=\s)|(?=\n)/g;

function boundaryFrom(text: string, start: number): number | null {
  BOUNDARY.lastIndex = start;
  const match = BOUNDARY.exec(text);
  if (!match) return null;
  return match.index + match[0].length;
}

function leadingSpace(text: string): number {
  return text.length - text.trimStart().length;
}

function mayBeOffer(start: string): boolean {
  const lower = start.toLowerCase();
  return OPENERS.some((opener) => lower.startsWith(opener) || opener.startsWith(lower));
}

function isOffer(sentence: string): boolean {
  return mayBeOffer(sentence.trimStart()) && OFFER.test(sentence);
}

export interface OfferFilter {
  /** Takes the next piece of streamed text; returns what can be shown now. */
  push(delta: string): string;
  /** The text still held back once the stream has ended. */
  flush(): string;
}

export function createOfferFilter(): OfferFilter {
  let pending = '';
  // Once a sentence is known not to be an offer, the rest of it streams freely.
  let passing = false;

  function drain(): string {
    let shown = '';
    for (;;) {
      // Mid-sentence, a line break right away ends it; at a sentence start,
      // the whitespace before it belongs to the new sentence.
      const midSentence = passing;
      const lead = midSentence ? 0 : leadingSpace(pending);
      if (!midSentence && lead === pending.length) return shown;
      if (!midSentence && !mayBeOffer(pending.slice(lead))) passing = true;

      const end = boundaryFrom(pending, lead);
      if (end === null) {
        if (!passing) return shown;
        // A final full stop may end the sentence once whitespace follows it.
        const free = /[.!?]$/.test(pending) ? pending.length - 1 : pending.length;
        shown += pending.slice(0, free);
        pending = pending.slice(free);
        return shown;
      }
      const sentence = pending.slice(0, end);
      pending = pending.slice(end);
      if (passing || !isOffer(sentence)) shown += sentence;
      passing = false;
    }
  }

  return {
    push(delta) {
      pending += delta;
      return drain();
    },
    flush() {
      const rest = pending;
      pending = '';
      return !passing && isOffer(rest) ? '' : rest;
    },
  };
}
