import type { ResponseKit } from '@/core/assistant/response-kit';

/**
 * The record's facts as the English answers say them. Prose names a company,
 * a period or a number only through these, so a change to the record changes
 * every answer that mentions it.
 */

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

/** Small counts read as words ("four developers"), larger ones as digits. */
export function inWords(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

/** "a" or "an", by the sound the word starts with. */
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** "A, B and C". */
export function joinNames(names: readonly string[]): string {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`
    : names.join('');
}

function change(value: string): readonly [before: string, after: string] {
  const [before = value, after = value] = value.split(' → ');
  return [before, after];
}

export function createFacts({ knowledge, roleById, projectById, metricValue }: ResponseKit) {
  const { profile } = knowledge;
  const employer = (roleId: string) => roleById(roleId).company;
  const title = (roleId: string) => roleById(roleId).role;
  const period = (roleId: string) => roleById(roleId).period;
  // A role's start is a fractional year: March 2026 is 2026 plus two twelfths.
  const startMonth = (roleId: string) => {
    const { start } = roleById(roleId);
    const year = Math.floor(start);
    const month = Math.round((start - year) * 12);
    const date = new Date(Date.UTC(year, month));
    return date.toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const years = (roleId: string) => {
    const [from = '', to = ''] = period(roleId).split(' — ');
    return { from, to };
  };
  const metric = (id: string) => metricValue(id);
  /** The award a role's achievements name, as they write it: "Golden Award in 2019". */
  const award = (roleId: string) => {
    const named = roleById(roleId)
      .achievements.map((achievement) => /\b((?:[A-Z]\w* )+Award) in (\d{4})\b/.exec(achievement))
      .find((match) => match !== null);
    if (!named?.[1] || !named[2]) throw new Error(`The "${roleId}" role names no award.`);
    return { name: named[1], won: `${named[1]} in ${named[2]}` };
  };
  /** "30%+" → "30%", for prose that says "at least" or "over" itself. */
  const amount = (id: string) => metricValue(id).replace(/^~|\+$/g, '');
  const before = (id: string) => change(metricValue(id))[0];
  const after = (id: string) => change(metricValue(id))[1];
  const count = (value: string) => Number.parseInt(value, 10);

  return {
    first: profile.firstName,
    /** "10+ years" → "over 10 years". */
    experience: profile.yearsLabel.replace(/^(\d+)\+/, 'over $1'),
    employer,
    title,
    period,
    years,
    startMonth,
    product: (projectId: string) => projectById(projectId).name,
    metric,
    award,
    amount,
    before,
    after,
    /** A metric's starting and final counts, in words: "1 → 4" → "one", "four". */
    countsInWords: (id: string) => ({
      from: inWords(count(before(id))),
      to: inWords(count(after(id))),
      added: inWords(count(after(id)) - count(before(id))),
    }),
  };
}

export type Facts = ReturnType<typeof createFacts>;
