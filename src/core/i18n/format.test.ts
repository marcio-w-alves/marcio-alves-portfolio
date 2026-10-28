import { describe, expect, it } from 'vitest';
import { interpolate, mapMessages, overrideMessages, plural, type Plural } from './format';

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
