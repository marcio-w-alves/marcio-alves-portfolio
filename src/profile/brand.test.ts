import { describe, expect, it } from 'vitest';
import type { ColorToken, Hex } from '@/site/site-profile';
import { brand } from './brand';

function luminance(hex: Hex): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Hex, b: Hex): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const SURFACES: readonly ColorToken[] = ['bg', 'ice', 'surface', 'fill', 'fill-hover'];

describe.each([
  ['light', brand.colors],
  ['dark', brand.darkColors],
] as const)('the %s palette', (_theme, colors) => {
  it.each(SURFACES)('keeps body and secondary text readable on %s (WCAG AA)', (surface) => {
    expect(contrast(colors.ink, colors[surface])).toBeGreaterThanOrEqual(7);
    expect(contrast(colors['ink-muted'], colors[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a label on the accent readable', () => {
    expect(contrast(colors['on-accent'], colors.accent)).toBeGreaterThanOrEqual(7);
    expect(contrast(colors['on-accent'], colors['accent-hover'])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps an error readable on its own tint', () => {
    expect(contrast(colors.danger, colors['danger-soft'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the dark palette', () => {
  it('names every token the light one does', () => {
    expect(Object.keys(brand.darkColors).sort()).toEqual(Object.keys(brand.colors).sort());
  });
});
