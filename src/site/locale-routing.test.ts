import {
  getRedirectUrl,
  getRewrittenUrl,
  unstable_getResponseFromNextConfig,
} from 'next/experimental/testing/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../../next.config';

const ORIGIN = 'https://ada.example';

async function responseFor(path: string) {
  return unstable_getResponseFromNextConfig({ url: `${ORIGIN}${path}`, nextConfig });
}

async function rewrittenPath(path: string): Promise<string | null> {
  return getRewrittenUrl(await responseFor(path))?.replace(ORIGIN, '') ?? null;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the routing the real next.config.ts declares', () => {
  it('serves every unprefixed page address from the English segment, query included', async () => {
    expect(await rewrittenPath('/')).toBe('/en');
    expect(await rewrittenPath('/skills')).toBe('/en/skills');
    expect(await rewrittenPath('/nope')).toBe('/en/nope');
    expect(await rewrittenPath('/ptx')).toBe('/en/ptx');
    expect(await rewrittenPath('/skills?q=1')).toBe('/en/skills?q=1');
  });

  it('still serves a page whose name merely starts with "en" from the English segment', async () => {
    expect(await rewrittenPath('/enroll')).toBe('/en/enroll');
  });

  it("leaves the API and Next's own assets alone", async () => {
    expect(await rewrittenPath('/api/chat')).toBeNull();
    expect(await rewrittenPath('/_next/static/x.js')).toBeNull();
  });

  it('answers /en addresses with a permanent redirect to the address the site writes', async () => {
    const home = await responseFor('/en');
    const skills = await responseFor('/en/skills');

    expect(home.status).toBe(308);
    expect(getRedirectUrl(home)).toBe(`${ORIGIN}/`);
    expect(skills.status).toBe(308);
    expect(getRedirectUrl(skills)).toBe(`${ORIGIN}/skills`);
  });

  it('sends /pt addresses to the English not-found page while Portuguese is not published', async () => {
    vi.stubEnv('PREVIEW_LOCALES', '');

    expect(await rewrittenPath('/pt')).toBe('/en/pt');
    expect(await rewrittenPath('/pt/skills')).toBe('/en/pt/skills');
  });

  it('serves /pt addresses from their own segment once Portuguese is built', async () => {
    vi.stubEnv('PREVIEW_LOCALES', 'pt-BR');

    expect(await rewrittenPath('/pt')).toBeNull();
    expect(await rewrittenPath('/pt/skills')).toBeNull();
    expect(await rewrittenPath('/pt/nope')).toBeNull();
    expect(await rewrittenPath('/ptx')).toBe('/en/ptx');
    expect(await rewrittenPath('/skills')).toBe('/en/skills');
  });
});
