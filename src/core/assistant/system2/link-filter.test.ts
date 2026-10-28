import { describe, expect, it } from 'vitest';
import { MAX_LABEL_LENGTH } from '@/core/markdown/markdown-link';
import { createLinkAllowList, createLinkFilter, urlsIn } from './link-filter';

const KNOWN = 'https://github.com/ada-rivera-example';

/** Streams the text the way the model does, a few characters at a time. */
function filtered(text: string, chunk = 3, known: readonly string[] = [KNOWN]): string {
  const allowList = createLinkAllowList(known);
  const filter = createLinkFilter((url) => allowList.allows(url));
  let shown = '';
  for (let index = 0; index < text.length; index += chunk) {
    shown += filter.push(text.slice(index, index + chunk));
  }
  return shown + filter.flush();
}

describe('links in a streamed answer', () => {
  it('renders a link to an unknown URL as its label, and keeps a known one', () => {
    expect(
      filtered(
        'See [docs](https://evil.example) and [GitHub](https://github.com/ada-rivera-example).',
      ),
    ).toBe('See docs and [GitHub](https://github.com/ada-rivera-example).');
  });

  it('keeps a link to a path on this site, such as the résumé', () => {
    expect(filtered('Here is [his résumé](/ada-rivera-cv.pdf).', 3, [])).toBe(
      'Here is [his résumé](/ada-rivera-cv.pdf).',
    );
  });

  it('renders as its label a link that only looks like a path but names another host', () => {
    expect(filtered('[cv](//evil.example/cv.pdf) and [cv](/\\evil.example/cv.pdf)', 3, [])).toBe(
      'cv and cv',
    );
  });

  it.each([1, 2, 3, 5, 7, 10])('gives the same output whatever the chunk size: %i', (chunk) => {
    const answer =
      'His [GitHub](https://github.com/ada-rivera-example) has it.\n- [login](https://evil.example/login?next=/) here\n';
    expect(filtered(answer, chunk)).toBe(
      'His [GitHub](https://github.com/ada-rivera-example) has it.\n- login here\n',
    );
  });

  it('shows nothing of a link before it is known to be allowed', () => {
    const filter = createLinkFilter(() => false);
    expect(filter.push('Go to [the ')).toBe('Go to ');
    expect(filter.push('page](https://evil.')).toBe('');
    expect(filter.push('example) now.')).toBe('the page now.');
  });

  it('reads a link inside another first, then the outer one with its label in place', () => {
    expect(filtered('[a [b](https://evil.one) c](https://evil.two)')).toBe('a b c');
    expect(filtered('[[x](https://evil.example)](https://github.com/ada-rivera-example)')).toBe(
      '[x](https://github.com/ada-rivera-example)',
    );
    expect(filtered('[a [b](https://github.com/ada-rivera-example) c](https://evil.example)')).toBe(
      '[a [b](https://github.com/ada-rivera-example) c](https://evil.example)',
    );
  });

  it('never takes brackets into a label, since labels do not nest', () => {
    expect(filtered('[a [b]](https://evil.example)')).toBe('[a [b]](https://evil.example)');
  });

  it('keeps an address holding one pair of parentheses whole', () => {
    const wiki = 'https://en.wikipedia.org/wiki/Angular_(web_framework)';
    expect(filtered(`[Angular](${wiki}) is a framework.`, 4, [wiki])).toBe(
      `[Angular](${wiki}) is a framework.`,
    );
    expect(filtered(`[Angular](${wiki}) is a framework.`, 4, [])).toBe('Angular is a framework.');
  });

  it('still filters a link inside brackets that never formed a link', () => {
    expect(filtered('[see [docs](https://evil.example)]')).toBe('[see docs]');
  });

  it('releases brackets that are not a link as they were written', () => {
    expect(filtered('Arrays like [1, 2] and [x] (later) stay.')).toBe(
      'Arrays like [1, 2] and [x] (later) stay.',
    );
  });

  it('releases an unterminated bracket at a line break', () => {
    const filter = createLinkFilter(() => false);
    expect(filter.push('A [note')).toBe('A ');
    expect(filter.push(' here\nnext')).toBe('[note here\nnext');
  });

  it('releases a bracket as soon as its label is too long to be a link', () => {
    const filter = createLinkFilter(() => false);
    const label = 'a'.repeat(MAX_LABEL_LENGTH);
    expect(filter.push(`[${label}`)).toBe('');
    expect(filter.push('b')).toBe(`[${label}b`);
  });

  it('holds a link that spans rounds of the same answer until it closes', () => {
    const filter = createLinkFilter(() => false);
    expect(filter.push('See [the docs](https://evil.exa')).toBe('See ');
    expect(filter.push('mple/login) now.')).toBe('the docs now.');
  });

  it('leaves links in a code block as written, and reads them again after it', () => {
    expect(
      filtered(
        '```md\n[x](https://evil.example)\n```\n[y](https://evil.example) `[z](https://evil.example)`',
      ),
    ).toBe('```md\n[x](https://evil.example)\n```\ny `z`');
  });

  it('releases what it still holds when the answer ends', () => {
    expect(filtered('Unclosed [label](https://evil.example')).toBe(
      'Unclosed [label](https://evil.example',
    );
    expect(filtered('Ends on [label]')).toBe('Ends on [label]');
  });

  it('refuses a link that merely looks like an allowed one', () => {
    expect(
      filtered('[x](javascript:alert(1)) [y](https://github.com.evil.example/ada-rivera-example)'),
    ).toBe('x y');
  });

  it('leaves a bare address as text, since the page never turns one into a link', () => {
    expect(filtered('Visit https://evil.example/login today.')).toBe(
      'Visit https://evil.example/login today.',
    );
  });
});

describe('the allowed addresses', () => {
  it('compares addresses regardless of host case, a trailing slash or a fragment', () => {
    const allowList = createLinkAllowList(['https://GitHub.com/ada-rivera-example/']);
    expect(allowList.allows('https://github.com/ada-rivera-example')).toBe(true);
    expect(allowList.allows('HTTPS://GITHUB.COM/ada-rivera-example#readme')).toBe(true);
    expect(allowList.allows('https://github.com/ada-rivera-example/other')).toBe(false);
    expect(allowList.allows('https://github.com/ADA-RIVERA-EXAMPLE')).toBe(false);
  });

  it('allows an address once it is added, and never one that is not an address', () => {
    const allowList = createLinkAllowList([]);
    expect(allowList.allows('https://example.org/a')).toBe(false);
    allowList.allow('https://example.org/a');
    expect(allowList.allows('https://example.org/a')).toBe(true);
    expect(allowList.allows('not a url')).toBe(false);
  });

  it('finds the addresses in data, but not addresses written inside prose', () => {
    expect(
      urlsIn({
        url: 'https://github.com/ada-rivera-example',
        repositories: [{ url: 'https://github.com/ada-rivera-example/site', stars: 3 }],
        contact: 'mailto:someone@example.com',
        extract: 'Phishing text: log in at https://evil.example/login now.',
        relative: '/resume.pdf',
        nothing: null,
      }),
    ).toEqual([
      'https://github.com/ada-rivera-example',
      'https://github.com/ada-rivera-example/site',
      'mailto:someone@example.com',
    ]);
  });
});
