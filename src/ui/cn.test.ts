import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cn, THEME_TOKENS } from './cn';

const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

function declaredTokens(namespace: string): string[] {
  const pattern = new RegExp(`--${namespace}-([\\w\\\\.-]+?):`, 'g');
  return [...globals.matchAll(pattern)]
    .map(([, name = '']) => name.replace(/\\/g, ''))
    .filter((name) => !name.includes('--'));
}

describe('cn', () => {
  it('keeps a custom font size next to a text colour', () => {
    expect(cn('text-13', 'text-ink-muted')).toBe('text-13 text-ink-muted');
  });

  it('lets the later of two conflicting tokens win', () => {
    expect(cn('text-13', 'text-11.5')).toBe('text-11.5');
    expect(cn('rounded-control', 'rounded-pill')).toBe('rounded-pill');
    expect(cn('font-book', 'font-medium')).toBe('font-medium');
    expect(cn('leading-label', 'leading-none')).toBe('leading-none');
  });

  it('lets a font size reset a line height set before it, so a leading must come after', () => {
    expect(cn('leading-none', 'text-14')).toBe('text-14');
    expect(cn('text-14 leading-none', 'px-4')).toBe('text-14 leading-none px-4');
  });

  it('drops falsy entries', () => {
    expect(cn('px-4', false, undefined, 'h-10')).toBe('px-4 h-10');
  });

  it.each([
    ['text', THEME_TOKENS.text],
    ['leading', THEME_TOKENS.leading],
    ['tracking', THEME_TOKENS.tracking],
    ['font-weight', THEME_TOKENS['font-weight']],
    ['radius', THEME_TOKENS.radius],
  ])('registers every --%s-* token declared in globals.css', (namespace, registered) => {
    expect([...registered].sort()).toEqual(declaredTokens(namespace).sort());
  });
});
