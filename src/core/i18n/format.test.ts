import { describe, expect, it } from 'vitest';
import {
  formatCalendarDate,
  formatNumber,
  formatPeriod,
  interpolate,
  isCalendarDate,
  mapMessages,
  overrideMessages,
  plural,
  type Plural,
} from './format';

describe('interpolate', () => {
  it('fills every placeholder it has a value for', () => {
    expect(
      interpolate('View {company} experience in {year}', { company: 'Acme', year: 2024 }),
    ).toBe('View Acme experience in 2024');
  });

  it('leaves a placeholder without a value for a later pass', () => {
    expect(interpolate('{firstName} at {company}', { firstName: 'Ada' })).toBe('Ada at {company}');
  });

  it('fills a value that is itself empty, rather than leaving the placeholder', () => {
    expect(interpolate('a{gap}b', { gap: '' })).toBe('ab');
  });
});

describe('plural', () => {
  const minutes: Plural = { one: '{count} minute', other: '{count} minutes' };

  it("picks the language's category for the count", () => {
    expect(plural('en', minutes, 1)).toBe('1 minute');
    expect(plural('en', minutes, 2)).toBe('2 minutes');
    expect(plural('en', minutes, 0)).toBe('0 minutes');
  });

  it('follows the rules of the locale it is given, not English', () => {
    // Portuguese (Brazil) treats 0 like 1.
    expect(plural('pt-BR', minutes, 0)).toBe('0 minute');
  });

  it('falls back to `other` where the category has no message of its own', () => {
    expect(plural('en', { other: '{count} × {unit}' }, 1, { unit: 'run' })).toBe('1 × run');
  });
});

describe('mapMessages', () => {
  it('transforms every string, inside plurals and lists, and keeps the shape', () => {
    const catalog = { a: 'x', b: { one: 'y', other: 'z' }, c: ['p', 'q'] };
    expect(mapMessages(catalog, (text) => `[${text}]`)).toEqual({
      a: '[x]',
      b: { one: '[y]', other: '[z]' },
      c: ['[p]', '[q]'],
    });
  });
});

describe('overrideMessages', () => {
  const catalog = {
    composer: { send: 'Send', stop: 'Stop' },
    thinking: ['Reading', 'Thinking'],
    wait: { one: 'a minute', other: '{count} minutes' },
  };

  it('replaces only the messages it is given', () => {
    expect(overrideMessages(catalog, { composer: { send: 'Ask' } })).toEqual({
      ...catalog,
      composer: { send: 'Ask', stop: 'Stop' },
    });
  });

  it('replaces a list whole, not item by item', () => {
    expect(overrideMessages(catalog, { thinking: ['Pondering'] }).thinking).toEqual(['Pondering']);
  });

  it('leaves the catalog as it is for no overrides', () => {
    expect(overrideMessages(catalog, {})).toEqual(catalog);
  });
});

describe('formatCalendarDate', () => {
  it('writes a month the way the language abbreviates it, with no connective', () => {
    expect(formatCalendarDate('2026-03', 'en')).toBe('Mar 2026');
    expect(formatCalendarDate('2026-03', 'pt-BR')).toBe('mar. 2026');
  });

  it('writes a year alone as the year', () => {
    expect(formatCalendarDate('2022', 'pt-BR')).toBe('2022');
  });
});

describe('formatPeriod', () => {
  it('runs from the start to the end, or to the present while it is held', () => {
    expect(formatPeriod('2022', '2026-03', 'en', 'Present')).toBe('2022 — Mar 2026');
    expect(formatPeriod('2026-06', null, 'pt-BR', 'atual')).toBe('jun. 2026 — atual');
  });
});

describe('formatNumber', () => {
  it("groups digits the language's way, which plural counts follow", () => {
    expect(formatNumber(1500, 'en')).toBe('1,500');
    expect(formatNumber(1500, 'pt-BR')).toBe('1.500');
    expect(plural('pt-BR', { other: '{count} minutos' }, 1500)).toBe('1.500 minutos');
  });
});

describe('isCalendarDate', () => {
  it('takes a year or a year and month, and nothing else', () => {
    expect(['2026', '2026-01', '2026-12'].every(isCalendarDate)).toBe(true);
    expect(['2026-13', '2026-1', 'Mar 2026', '26'].some(isCalendarDate)).toBe(false);
  });
});
