import { getRewrittenUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';
import { config, proxy } from './proxy';

describe('the proxy', () => {
  it('serves the home page from the English segment, query included', () => {
    const response = proxy(new NextRequest('https://ada.example/?q=1'));
    expect(getRewrittenUrl(response)).toBe('https://ada.example/en?q=1');
  });

  it('runs for the home page alone, leaving every other address to the config rewrites', () => {
    const runsFor = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig, url });
    expect(runsFor('/')).toBe(true);
    expect(runsFor('/skills')).toBe(false);
    expect(runsFor('/api/chat')).toBe(false);
  });
});
