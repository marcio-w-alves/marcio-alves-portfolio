import type { ResponseKit } from '@/core/assistant/response-kit';

/**
 * The record's facts as the Portuguese answers say them. Prose names a
 * company, a period or a number only through these, so a change to the record
 * changes every answer that mentions it.
 */

// Masculine, like every noun the answers count: desenvolvedores, segundos, idiomas, produtos.
const NUMBER_WORDS = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
];

/** Small counts read as words ("quatro desenvolvedores"), larger ones as digits. */
export function inWords(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

/** "A, B e C". */
export function joinNames(names: readonly string[]): string {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} e ${names.at(-1) ?? ''}`
    : names.join('');
}

export function capitalized(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
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
  // A start the record gives as a year alone reads as its January.
  const startMonth = (roleId: string) => {
    const [year = '', month = '01'] = roleById(roleId).start.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1));
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const years = (roleId: string) => {
    const [from = '', to = ''] = period(roleId).split(' — ');
    return { from, to };
  };
  /** The award a role's achievements name, as they write it: "Golden Award em 2019". */
  const award = (roleId: string) => {
    const named = roleById(roleId)
      .achievements.map((achievement) => /\b((?:[A-Z]\w* )+Award) em (\d{4})\b/.exec(achievement))
      .find((match) => match !== null);
    if (!named?.[1] || !named[2]) throw new Error(`The "${roleId}" role names no award.`);
    return { name: named[1], won: `${named[1]} em ${named[2]}` };
  };
  /** "30%+" → "30%", for prose that says "pelo menos" or "mais de" itself. */
  const amount = (id: string) => metricValue(id).replace(/^~|\+$/g, '');
  const before = (id: string) => change(metricValue(id))[0];
  const after = (id: string) => change(metricValue(id))[1];
  const count = (value: string) => Number.parseInt(value, 10);

  return {
    first: profile.firstName,
    /** "10+ anos" → "mais de 10 anos". */
    experience: profile.yearsLabel.replace(/^(\d+)\+/, 'mais de $1'),
    employer,
    title,
    period,
    years,
    startMonth,
    product: (projectId: string) => projectById(projectId).name,
    metric: (id: string) => metricValue(id),
    award,
    amount,
    before,
    after,
    /** A metric's starting and final counts, in words: "1 → 4" → "um", "quatro". */
    countsInWords: (id: string) => ({
      from: inWords(count(before(id))),
      to: inWords(count(after(id))),
      added: inWords(count(after(id)) - count(before(id))),
    }),
  };
}
