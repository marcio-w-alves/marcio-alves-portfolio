import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { brandColors } from './brand-colors';

const globals = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function token(name: string): string | undefined {
  return new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(globals)?.[1];
}

it.each(Object.entries(brandColors))('keeps %s equal to its design token', (name, value) => {
  expect(token(name)).toBe(value);
});
