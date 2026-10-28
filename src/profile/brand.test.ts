import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brand } from './brand';

const globals = readFileSync(new URL('../ui/globals.css', import.meta.url), 'utf8');

function stylesheetColors(): Record<string, string> {
  const declarations = globals.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6});/gi);
  return Object.fromEntries([...declarations].map(([, token = '', value = '']) => [token, value]));
}

describe('the brand colours', () => {
  it('are the stylesheet’s colour tokens, every one and no other', () => {
    expect(stylesheetColors()).toEqual(brand.colors);
  });
});
