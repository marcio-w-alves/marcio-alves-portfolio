import { describe, expect, it } from 'vitest';
import { fixtureBrand } from '@/testing/fixture-profile/brand';
import { renderBrandCss } from './brand-css';
import type { Brand } from './site-profile';

function declarations(css: string): Record<string, string> {
  const found = css.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm);
  return Object.fromEntries([...found].map(([, name = '', value = '']) => [name, value]));
}

/** The declarations inside the block a selector opens, and only those. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No "${selector}" block.`);
  return declarations(css.slice(start, css.indexOf('\n}', start)));
}

describe('renderBrandCss', () => {
  const tokens = block(renderBrandCss(fixtureBrand), '@theme');

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
    expect(block(renderBrandCss(recoloured), '@theme')['--color-ink']).toBe('#123456');
    expect(tokens['--color-ink']).not.toBe('#123456');
  });

  it('overrides every colour token on the root element for the dark theme', () => {
    const dark = block(renderBrandCss(fixtureBrand), ":root[data-theme='dark']");
    for (const [token, hex] of Object.entries(fixtureBrand.darkColors)) {
      expect(dark[`--color-${token}`]).toBe(hex);
    }
  });

  it('tells the browser which scheme each theme is, for its own controls and scrollbars', () => {
    const css = renderBrandCss(fixtureBrand);
    expect(css).toMatch(/:root \{\n {2}color-scheme: light;/);
    expect(css).toMatch(/:root\[data-theme='dark'\] \{\n {2}color-scheme: dark;/);
  });

  it('is a Tailwind theme block', () => {
    expect(renderBrandCss(fixtureBrand)).toMatch(/^@theme \{$/m);
  });
});
