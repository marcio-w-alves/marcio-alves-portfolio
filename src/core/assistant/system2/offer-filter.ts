/**
 * Removes offers of help ("If you need more details, feel free to ask!") from
 * the model's text as it streams. The prompt forbids them, but the model
 * still writes them; the page already suggests what to ask next, so they
 * only add noise.
 *
 * Text is passed through as it arrives. Only a sentence that begins the way
 * an offer begins is held back until it ends, then dropped if it is one.
 * A sentence that carries a fact is never an offer, however it begins.
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

const OFFER_PHRASE =
  /feel free|let me know|\b(?:just ask|ask away)\b|happy to help|\bI can tell you (?:more )?about\b|\b(?:need|want|would like|'d like|have)\b (?:any (?:more |further |other )?|more |further |other |additional )(?:details|information|questions)\b|à (?:sua )?disposição|fique à vontade|não hesite|é só perguntar|\bposso (?:falar|contar)\b|\bpergunte\b|mais (?:informações|detalhes)|outras perguntas|no dudes|a (?:tu|su) disposición|más (?:información|detalles)|otras preguntas|\bpuedo contarte\b|pregúnta(?:me)?\b|\bpregunte\b/i;

const THIRD_PERSON = ['he', 'his', 'him', 'she', 'her', 'ele', 'ela', 'dele', 'dela', 'él', 'ella'];

function wholeWords(words: readonly string[]): RegExp {
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![\\p{L}\\d])(?:${escaped.join('|')})(?![\\p{L}\\d])`, 'iu');
}

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

function offerDetector(subjectNames: readonly string[]): (sentence: string) => boolean {
  const subject = wholeWords([...THIRD_PERSON, ...subjectNames]);
  const statesFact = (clause: string) =>
    !OFFER_PHRASE.test(clause) && (/\d/.test(clause) || subject.test(clause));
  // The condition ("If you need more details about his work,") may name the
  // person or a number; only the clauses after it can state a fact.
  const carriesFact = (sentence: string) => sentence.split(/[,;:]/).slice(1).some(statesFact);
  return (sentence) =>
    mayBeOffer(sentence.trimStart()) && OFFER_PHRASE.test(sentence) && !carriesFact(sentence);
}

export interface OfferFilter {
  /** Takes the next piece of streamed text; returns what can be shown now. */
  push(delta: string): string;
  /** The text still held back once the stream has ended. */
  flush(): string;
}

export interface OfferFilterOptions {
  /** Names the answers use for the person they are about. */
  subjectNames?: readonly string[];
}

export function createOfferFilter({ subjectNames = [] }: OfferFilterOptions = {}): OfferFilter {
  const isOffer = offerDetector(subjectNames);
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
