import { describe, expect, it } from 'vitest';
import { localeOfPath, mapTranslations } from './locale';

describe('the language of an address, without knowing which are published', () => {
  it('reads it from the first segment, English for anything else', () => {
    expect(localeOfPath('/pt')).toBe('pt-BR');
    expect(localeOfPath('/pt/skills')).toBe('pt-BR');
    expect(localeOfPath('/skills')).toBe('en');
    expect(localeOfPath('/ptx')).toBe('en');
    expect(localeOfPath('/')).toBe('en');
  });
});

describe('turning each translation into something else', () => {
  it('keeps exactly the languages that were written', () => {
    const tagged = (text: string, locale: string) => `${locale}:${text}`;

    expect(mapTranslations({ en: 'one' }, tagged)).toEqual({ en: 'en:one' });
    expect(mapTranslations({ en: 'one', 'pt-BR': 'um' }, tagged)).toEqual({
      en: 'en:one',
      'pt-BR': 'pt-BR:um',
    });
  });
});
