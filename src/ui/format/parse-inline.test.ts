import { describe, expect, it } from 'vitest';
import { isSafeHref, parseInline } from './parse-inline';

describe('parseInline', () => {
  it('splits bold, code and links out of the surrounding text', () => {
    expect(
      parseInline('Led **HRIS** with `React` — see [LinkedIn](https://linkedin.com/in/x).'),
    ).toEqual([
      { kind: 'text', text: 'Led ' },
      { kind: 'strong', text: 'HRIS' },
      { kind: 'text', text: ' with ' },
      { kind: 'code', text: 'React' },
      { kind: 'text', text: ' — see ' },
      { kind: 'link', text: 'LinkedIn', href: 'https://linkedin.com/in/x', external: true },
      { kind: 'text', text: '.' },
    ]);
  });

  it('keeps a mailto link on the page rather than marking it external', () => {
    expect(parseInline('[Email](mailto:marcio@example.com)')).toEqual([
      { kind: 'link', text: 'Email', href: 'mailto:marcio@example.com', external: false },
    ]);
  });

  it('keeps an address with parentheses in it whole, as encyclopedia links have', () => {
    expect(
      parseInline('See [Angular](https://en.wikipedia.org/wiki/Angular_(web_framework)).'),
    ).toEqual([
      { kind: 'text', text: 'See ' },
      {
        kind: 'link',
        text: 'Angular',
        href: 'https://en.wikipedia.org/wiki/Angular_(web_framework)',
        external: true,
      },
      { kind: 'text', text: '.' },
    ]);
  });

  it('reads the scheme of a link in any case', () => {
    expect(parseInline('[Site](HTTPS://EXAMPLE.COM) [Mail](MAILTO:a@b.co)')).toEqual([
      { kind: 'link', text: 'Site', href: 'HTTPS://EXAMPLE.COM', external: true },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'Mail', href: 'MAILTO:a@b.co', external: false },
    ]);
  });

  it('does not let bold or code run across a line break', () => {
    expect(parseInline('**a\nb** `c\nd`')).toEqual([{ kind: 'text', text: 'a\nb `c\nd`' }]);
  });

  it('keeps text in any script, emoji included, exactly as written', () => {
    const source = 'Liderança 🚀 — 日本語 — **Ação**';
    expect(parseInline(source)).toEqual([
      { kind: 'text', text: 'Liderança 🚀 — 日本語 — ' },
      { kind: 'strong', text: 'Ação' },
    ]);
  });

  it.each([
    '[click](javascript:alert(1))',
    '[click](JavaScript:alert(1))',
    '[click](data:text/html;base64,PHNjcmlwdD4=)',
    '[click](vbscript:msgbox)',
    '[click](//evil.example.com)',
    '[click](/relative/path)',
  ])('leaves the unsafe link %s as plain text', (source) => {
    const nodes = parseInline(source);
    expect(nodes.every((node) => node.kind === 'text')).toBe(true);
    expect(nodes.map((node) => node.text).join('')).toBe(source);
  });

  it('never turns HTML in the source into anything but text', () => {
    const source = '<img src=x onerror=alert(1)> <script>alert(1)</script>';
    expect(parseInline(source)).toEqual([{ kind: 'text', text: source }]);
  });

  it('drops an unpaired bold marker instead of showing it', () => {
    expect(parseInline('a ** b')).toEqual([{ kind: 'text', text: 'a  b' }]);
  });

  it('does not treat empty markers as formatting', () => {
    expect(parseInline('``')).toEqual([{ kind: 'text', text: '``' }]);
  });

  it('yields nothing for empty text', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('isSafeHref', () => {
  it('allows only web and mail links', () => {
    expect(isSafeHref('https://github.com/marcio-w-alves')).toBe(true);
    expect(isSafeHref('http://example.com')).toBe(true);
    expect(isSafeHref('mailto:a@b.co')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref(' https://example.com')).toBe(false);
  });
});
