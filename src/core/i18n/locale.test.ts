import { describe, expect, it } from 'vitest';
import { localeOfPath } from './locale';

describe('the language of an address, without knowing which are published', () => {
  it('reads it from the first segment, English for anything else', () => {
    expect(localeOfPath('/pt')).toBe('pt-BR');
    expect(localeOfPath('/pt/skills')).toBe('pt-BR');
    expect(localeOfPath('/skills')).toBe('en');
    expect(localeOfPath('/ptx')).toBe('en');
    expect(localeOfPath('/')).toBe('en');
  });
});
