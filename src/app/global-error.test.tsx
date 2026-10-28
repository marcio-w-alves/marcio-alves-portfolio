import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { globalErrorSubject } from '@/profile/global-error-copy';
import GlobalError from './global-error';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
// next/font is compiled by Next; outside it, the font loaders only name a class.
vi.mock('@/profile/fonts', () => ({ fontClassName: 'fonts' }));

function renderAt(pathname: string): Document {
  navigation.pathname = pathname;
  const html = renderToStaticMarkup(
    <GlobalError error={new Error('boom')} retry={vi.fn()} reset={vi.fn()} />,
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('the last-resort error page', () => {
  beforeEach(() => {
    navigation.pathname = '/';
  });

  it('speaks English on an unprefixed address', () => {
    const page = renderAt('/experience');

    expect(page.documentElement.lang).toBe('en');
    expect(page.querySelector('h1')?.textContent).toBe('This page failed to load');
    expect(page.title).toBe(`Something went wrong — ${globalErrorSubject.name}`);
  });

  it("speaks Portuguese on a Portuguese address, the path's language", () => {
    const page = renderAt('/pt/experience');

    expect(page.documentElement.lang).toBe('pt-BR');
    expect(page.querySelector('h1')?.textContent).toBe('Esta página não carregou');
    expect(page.title).toBe(`Algo deu errado — ${globalErrorSubject.name}`);
  });

  it('takes an address that only starts like a language for English', () => {
    expect(renderAt('/ptx').documentElement.lang).toBe('en');
  });
});
