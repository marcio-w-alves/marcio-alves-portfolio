import { describe, expect, it } from 'vitest';
import { fixtureBrand } from '@/testing/fixture-profile/brand';
import { renderBrandCss } from './brand-css';
import type { Brand } from './site-profile';

function declarations(css: string): Record<string, string> {
  const found = css.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm);
  return Object.fromEntries([...found].map(([, name = '', value = '']) => [name, value]));
}

describe('renderBrandCss', () => {
  const tokens = declarations(renderBrandCss(fixtureBrand));

  it('declares a colour token for every colour of the brand, with its value', () => {
    for (const [token, hex] of Object.entries(fixtureBrand.colors)) {
      expect(tokens[`--color-${token}`]).toBe(hex);
    }
  });

  it("puts each family's own face first, then the brand's fallbacks", () => {
    expect(tokens['--font-sans']).toBe('var(--font-face-text), Georgia, serif');
    expect(tokens['--font-display']).toBe('var(--font-face-display), Georgia, serif');
    expect(tokens['--font-mono']).toBe('var(--font-face-code), monospace');
  });

  it('sets font features only for a family that has them', () => {
    const featured: Brand = {
      ...fixtureBrand,
      fonts: { ...fixtureBrand.fonts, sans: { fallbacks: ['serif'], featureSettings: "'ss01'" } },
    };
    expect(declarations(renderBrandCss(featured))['--font-sans--font-feature-settings']).toBe(
      "'ss01'",
    );
    expect(tokens['--font-sans--font-feature-settings']).toBeUndefined();
  });

  it('follows a colour changed in the profile', () => {
    const recoloured: Brand = {
      ...fixtureBrand,
      colors: { ...fixtureBrand.colors, ink: '#123456' },
    };
    expect(declarations(renderBrandCss(recoloured))['--color-ink']).toBe('#123456');
    expect(tokens['--color-ink']).not.toBe('#123456');
  });

  it('is a Tailwind theme block', () => {
    expect(renderBrandCss(fixtureBrand)).toMatch(/^@theme \{$/m);
  });
});
