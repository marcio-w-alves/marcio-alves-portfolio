import { describe, expect, it } from 'vitest';
import { assetPath, counterparts, localeFromSegment, pagePath } from './routes';

describe('page addresses', () => {
  it('writes English unprefixed and Portuguese under /pt, with the same slugs', () => {
    expect(pagePath('en', 'overview')).toBe('/');
    expect(pagePath('en', 'skills')).toBe('/skills');
    expect(pagePath('pt-BR', 'overview')).toBe('/pt');
    expect(pagePath('pt-BR', 'skills')).toBe('/pt/skills');
  });

  it('finds the same page in each published language, and only those', () => {
    expect(counterparts('skills', ['en', 'pt-BR'])).toEqual({
      en: '/skills',
      'pt-BR': '/pt/skills',
    });
    expect(counterparts('skills', ['en'])).toEqual({ en: '/skills' });
  });

  it('serves a published language from its segment, and nothing from any other', () => {
    expect(localeFromSegment('en', ['en'])).toBe('en');
    expect(localeFromSegment('pt', ['en', 'pt-BR'])).toBe('pt-BR');
    expect(localeFromSegment('pt', ['en'])).toBeNull();
    expect(localeFromSegment('fr', ['en', 'pt-BR'])).toBeNull();
    expect(localeFromSegment('pt-BR', ['en', 'pt-BR'])).toBeNull();
  });

  it("places a language's generated files under its prefix", () => {
    expect(assetPath('en', 'brand/share-image.png')).toBe('/brand/share-image.png');
    expect(assetPath('pt-BR', 'brand/share-image.png')).toBe('/pt/brand/share-image.png');
  });
});
