import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderBrandCss } from '@/site/brand-css';
import { brand } from '../brand';

const committed = readFileSync(new URL('./brand.css', import.meta.url), 'utf8');

describe('the brand stylesheet', () => {
  it('is the one the profile generates', () => {
    expect(committed, 'src/profile/brand.ts changed: run pnpm brand:css').toBe(
      renderBrandCss(brand),
    );
  });
});
