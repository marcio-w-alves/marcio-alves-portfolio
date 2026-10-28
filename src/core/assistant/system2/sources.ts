import type { AnswerSource } from '../assistant-event';
import type { ToolResult } from '../tools/tool';

/** The text an action returned on behalf of one source. */
export interface SourceEvidence {
  readonly source: AnswerSource;
  readonly text: string;
}

const SHARED_PHRASES = 2;
const MIN_WORD = 3;
const MIN_NAME = 2;

// Words that carry no fact of their own, in the languages answers are written in.
const FUNCTION_WORDS = new Set(
  `the and for with from that this these those his her him she was were has have had are is
  of to in on at by as an or it its be been into also which who their they them not but
  during where when while there he a
  o os de da do das dos em na no nas nos um uma e ou que com por para pela pelo ele ela seu
  sua seus suas foi era é ao aos à se mais como também já onde quando entre sobre isso esse
  essa este esta dele dela
  el la los las del con su sus fue y`.split(/\s+/),
);

function wordsOf(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isFunctionWord(word: string): boolean {
  return FUNCTION_WORDS.has(word.toLowerCase());
}

/** Runs of three content words, so a paraphrase of a statement still shares them. */
function phrasesOf(text: string): Set<string> {
  const words = wordsOf(text)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= MIN_WORD && !isFunctionWord(word));
  return new Set(words.slice(2).map((_, index) => words.slice(index, index + 3).join(' ')));
}

/**
 * Words written as names: capitalized, but not merely because they open a
 * sentence or a line.
 */
function namesIn(answer: string): Set<string> {
  return new Set(
    answer
      .split(/(?<=[.!?])\s+|\n+/)
      .flatMap((sentence) => wordsOf(sentence).slice(1))
      .filter((word) => word.length >= MIN_NAME && /\p{Lu}/u.test(word) && !isFunctionWord(word)),
  );
}

function countShared(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  return [...a].filter((item) => b.has(item)).length;
}

interface Vouched {
  readonly source: AnswerSource;
  readonly words: ReadonlySet<string>;
  readonly phrases: ReadonlySet<string>;
}

function bySource(evidence: readonly SourceEvidence[]): Vouched[] {
  const sources = distinct(evidence.map(({ source }) => source));
  return sources.map((source) => {
    const text = evidence
      .filter((item) => item.source.id === source.id)
      .map((item) => item.text)
      .join('\n');
    return { source, words: new Set(wordsOf(text)), phrases: phrasesOf(text) };
  });
}

/**
 * The sources an answer rests on: those it paraphrases, sharing at least two
 * runs of content words, or names — a company or product reads the same in a
 * Portuguese answer to an English record. A name counts only when a single
 * source carries it: the person the record is about, his title or his main
 * stack appear in most of them and point to none.
 */
export function usedSources(answer: string, evidence: readonly SourceEvidence[]): AnswerSource[] {
  const vouched = bySource(evidence);
  const phrases = phrasesOf(answer);
  const names = [...namesIn(answer)].filter(
    (name) => vouched.filter(({ words }) => words.has(name)).length === 1,
  );
  return vouched
    .filter(
      ({ words, phrases: own }) =>
        names.some((name) => words.has(name)) || countShared(own, phrases) >= SHARED_PHRASES,
    )
    .map(({ source }) => source);
}

export function distinct(sources: readonly AnswerSource[]): AnswerSource[] {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

function textsIn(data: unknown): string[] {
  if (typeof data === 'string') return [data];
  if (typeof data === 'number') return [String(data)];
  if (Array.isArray(data)) return data.flatMap(textsIn);
  if (data && typeof data === 'object') return Object.values(data).flatMap(textsIn);
  return [];
}

/** What each source of an action's result vouches for. */
export function evidenceOf(result: ToolResult): SourceEvidence[] {
  const whole = textsIn(result.data).join('\n');
  return result.sources.map((source) => ({
    source,
    text: result.evidence?.[source.id] ?? whole,
  }));
}
