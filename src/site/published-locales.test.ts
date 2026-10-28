import { describe, expect, it } from 'vitest';
import { publishedLocales } from './published-locales';

describe('the languages a build serves', () => {
  it("are the profile's alone when nothing is previewed", () => {
    expect(publishedLocales(['en'], {})).toEqual(['en']);
    expect(publishedLocales(['en', 'pt-BR'], {})).toEqual(['en', 'pt-BR']);
  });

  it('add a previewed language beside them', () => {
    expect(publishedLocales(['en'], { PREVIEW_LOCALES: 'pt-BR' })).toEqual(['en', 'pt-BR']);
    expect(publishedLocales(['en'], { PREVIEW_LOCALES: ' pt-BR , ' })).toEqual(['en', 'pt-BR']);
  });

  it('refuse a previewed language the site cannot speak, naming it', () => {
    expect(() => publishedLocales(['en'], { PREVIEW_LOCALES: 'fr' })).toThrow(/"fr"/);
  });

  it('never let a preview reach the public site', () => {
    expect(() =>
      publishedLocales(['en'], { PREVIEW_LOCALES: 'pt-BR', VERCEL_ENV: 'production' }),
    ).toThrow(/production/);
    expect(publishedLocales(['en'], { PREVIEW_LOCALES: 'pt-BR', VERCEL_ENV: 'preview' })).toEqual([
      'en',
      'pt-BR',
    ]);
  });
});
