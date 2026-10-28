/**
 * Message catalogs as plain data: strings with `{name}` placeholders and
 * plurals keyed by `Intl.PluralRules` categories. Framework-free, so the core,
 * the server and the browser format the same catalog the same way.
 */

/** A message with `{name}` placeholders, e.g. "View {company} experience". */
export type Template = string;

/** One message per plural category of a language; `other` is the one every language has. */
export type Plural = { readonly other: Template } & Partial<
  Readonly<Record<Intl.LDMLPluralRule, Template>>
>;

export type MessageValues = Readonly<Record<string, string | number>>;

/** A catalog with any of its messages replaced; lists are replaced whole. */
export type Overrides<T> = {
  readonly [Key in keyof T]?: T[Key] extends string | readonly unknown[]
    ? T[Key]
    : Overrides<T[Key]>;
};

/**
 * Fills each placeholder there is a value for and leaves the rest, so a
 * catalog can be filled in two passes: who the site is about on the server,
 * what an answer is about in the browser.
 */
export function interpolate(template: Template, values: MessageValues): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}

/** The message for `count` under the language's plural rules, with `{count}` written as the language writes numbers. */
export function plural(
  locale: string,
  message: Plural,
  count: number,
  values: MessageValues = {},
): string {
  const category = new Intl.PluralRules(locale).select(count);
  return interpolate(message[category] ?? message.other, {
    ...values,
    count: formatNumber(count, locale),
  });
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** A date as a résumé gives it: `2026-03` where it names the month, `2026` where only the year. */
export type CalendarDate = string;

const CALENDAR_DATE = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/;

export function isCalendarDate(value: string): value is CalendarDate {
  return CALENDAR_DATE.test(value);
}

/**
 * The month and year as the language abbreviates them (`Mar 2026`, `mar. 2026`),
 * or the year alone. Only those two parts are kept, so no connective such as
 * Portuguese "de" comes between them.
 */
export function formatCalendarDate(date: CalendarDate, locale: string): string {
  const [, year = date, month] = CALENDAR_DATE.exec(date) ?? [];
  if (!month) return year;
  const format = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return format
    .formatToParts(Date.UTC(Number(year), Number(month) - 1))
    .filter(({ type }) => type === 'month' || type === 'year')
    .map(({ value }) => value)
    .join(' ');
}

/** From the start to the end, or to `present` while it is still going on. */
export function formatPeriod(
  start: CalendarDate,
  end: CalendarDate | null,
  locale: string,
  present: string,
): string {
  const until = end === null ? present : formatCalendarDate(end, locale);
  return `${formatCalendarDate(start, locale)} — ${until}`;
}

function isCatalog(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every string of a catalog, plurals and lists included, passed through `transform`. */
export function mapMessages<T>(catalog: T, transform: (message: string) => string): T {
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') return transform(value);
    if (Array.isArray(value)) return value.map(visit);
    if (isCatalog(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    }
    return value;
  };
  return visit(catalog) as T;
}

/** The catalog with the overridden messages in place of its own. */
export function overrideMessages<T>(catalog: T, overrides: Overrides<T>): T {
  const merge = (base: unknown, override: unknown): unknown => {
    if (!isCatalog(base) || !isCatalog(override)) return override ?? base;
    return Object.fromEntries(
      Object.entries(base).map(([key, value]) => [key, merge(value, override[key])]),
    );
  };
  return merge(catalog, overrides) as T;
}
