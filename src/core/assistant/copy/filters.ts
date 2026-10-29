import type { Locale } from '../../i18n/locale';
import { bullets, numbered } from '../response-kit';

/**
 * The template language's filters: a closed list, each with a typed input and
 * a fixed number of arguments. Where a filter is grammar it reads the
 * language's own table; a language without one cannot use it.
 */

export type FieldName = string;

export type ArgumentKind = 'value' | 'regex' | 'field';

/** A filter given the wrong kind of value: the renderer adds where. */
export class FilterProblem extends Error {}

export interface FilterSpec {
  readonly args: readonly ArgumentKind[];
  /** The languages it has a form in; every language when absent. */
  readonly locales?: readonly Locale[];
  readonly apply: (input: unknown, args: readonly unknown[], locale: Locale) => unknown;
}

const NUMBER_WORDS: Readonly<Record<Locale, readonly string[]>> = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  // Masculine, like every noun the answers count: desenvolvedores, segundos, idiomas, produtos.
  'pt-BR': ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
};

const LIST_AND: Readonly<Record<Locale, string>> = { en: 'and', 'pt-BR': 'e' };

const CALENDAR_DATE = /^(\d{4})(?:-(\d{2}))?$/;
const LEADING_INTEGER = /^\d+/;

function kindOf(value: unknown): string {
  if (value === null || value === undefined) return 'nothing';
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `the ${typeof value} "${String(value)}"`;
  }
  return 'an object';
}

function needs(filter: string, what: string, value: unknown): never {
  throw new FilterProblem(`Filter "${filter}" needs ${what}, got ${kindOf(value)}`);
}

function stringOf(filter: string, value: unknown): string {
  if (typeof value !== 'string') needs(filter, 'a string', value);
  return value;
}

function listOf(filter: string, value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) needs(filter, 'a list', value);
  return value;
}

function stringsOf(filter: string, value: unknown): string[] {
  return listOf(filter, value).map((item) => stringOf(filter, item));
}

function recordOf(filter: string, value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    needs(filter, 'a list of objects', value);
  }
  return value as Readonly<Record<string, unknown>>;
}

function fieldOf(filter: string, item: unknown, field: string): unknown {
  const record = recordOf(filter, item);
  if (!Object.hasOwn(record, field)) {
    throw new FilterProblem(`Filter "${filter}": an item has no field "${field}"`);
  }
  return record[field];
}

/** The template language's falsy values: nothing, false, "" and []. Zero is true. */
export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === '') return false;
  return !(Array.isArray(value) && value.length === 0);
}

/** A string filter applies to a string, or to each string of a list. */
function eachString(filter: string, transform: (text: string) => string) {
  return (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map((item) => transform(stringOf(filter, item)))
      : transform(stringOf(filter, input));
}

function words(input: unknown, _args: readonly unknown[], locale: Locale): string {
  let count: number;
  if (typeof input === 'number' && Number.isInteger(input) && input >= 0) count = input;
  else if (typeof input === 'string' && LEADING_INTEGER.test(input))
    count = Number.parseInt(input, 10);
  else needs('words', 'a whole number', input);
  return NUMBER_WORDS[locale][count] ?? String(count);
}

function monthYear(input: unknown, _args: readonly unknown[], locale: Locale): string {
  const [, year, month] = CALENDAR_DATE.exec(stringOf('monthYear', input)) ?? [];
  if (!year) needs('monthYear', 'a date written YYYY or YYYY-MM', input);
  if (!month) return year;
  return new Date(Date.UTC(Number(year), Number(month) - 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function list(input: unknown, _args: readonly unknown[], locale: Locale): string {
  const names = stringsOf('list', input);
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} ${LIST_AND[locale]} ${names.at(-1) ?? ''}`
    : names.join('');
}

function sameItem(item: unknown, excluded: unknown): boolean {
  if (item === excluded) return true;
  const id = (value: unknown) =>
    typeof value === 'object' && value !== null && Object.hasOwn(value, 'id')
      ? (value as { id: unknown }).id
      : undefined;
  return id(item) !== undefined && id(item) === id(excluded);
}

export const FILTERS: Readonly<Record<string, FilterSpec | undefined>> = {
  words: { args: [], apply: words },
  withArticle: {
    args: [],
    locales: ['en'],
    apply: (input) => {
      const word = stringOf('withArticle', input);
      return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
    },
  },
  list: { args: [], apply: list },
  monthYear: { args: [], apply: monthYear },
  capitalize: {
    args: [],
    apply: eachString('capitalize', (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`),
  },
  lowerFirst: {
    args: [],
    apply: eachString('lowerFirst', (text) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`),
  },
  lower: { args: [], apply: eachString('lower', (text) => text.toLowerCase()) },
  replace: {
    args: ['regex', 'value'],
    apply: (input, [pattern, replacement]) =>
      eachString('replace', (text) =>
        text.replace(pattern as RegExp, stringOf('replace', replacement)),
      )(input),
  },
  matching: {
    args: ['regex'],
    apply: (input, [pattern]) =>
      stringsOf('matching', input).filter((text) => (pattern as RegExp).test(text)),
  },
  where: {
    args: ['field'],
    apply: (input, [field]) =>
      listOf('where', input).filter((item) => isTruthy(fieldOf('where', item, field as string))),
  },
  whereNot: {
    args: ['field'],
    apply: (input, [field]) =>
      listOf('whereNot', input).filter(
        (item) => !isTruthy(fieldOf('whereNot', item, field as string)),
      ),
  },
  except: {
    args: ['value'],
    apply: (input, [excluded]) =>
      listOf('except', input).filter((item) => !sameItem(item, excluded)),
  },
  map: {
    args: ['field'],
    apply: (input, [field]) =>
      listOf('map', input).map((item) => fieldOf('map', item, field as string)),
  },
  first: { args: [], apply: (input) => listOf('first', input)[0] ?? null },
  count: {
    args: [],
    apply: (input) =>
      Array.isArray(input) ? input.length : Object.keys(recordOf('count', input)).length,
  },
  join: {
    args: ['value'],
    apply: (input, [separator]) =>
      listOf('join', input)
        .map((item) => stringOf('join', item))
        .join(stringOf('join', separator)),
  },
  bullets: { args: [], apply: (input) => bullets(stringsOf('bullets', input)) },
  numbered: { args: [], apply: (input) => numbered(stringsOf('numbered', input)) },
};
