import { describe, expect, it } from 'vitest';
import type { SitePassage } from '../../src/core/knowledge/schema';
import { stalePages } from './staleness';

function passage(url: string, fetchedAt: string, n = 0): SitePassage {
  return {
    id: `site/pipewright/${String(n)}`,
    subject: { kind: 'project', id: 'pipewright' },
    url,
    fetchedAt,
    language: 'en',
    text: 'Pipewright rebuilds only what changed.',
  };
}

describe('stale site pages', () => {
  const now = new Date('2026-10-28T18:30:00Z');

  it('lists a page read 181 days ago, once, and not one read 180 days ago', () => {
    const entries = [
      passage('https://a.example/', '2026-04-30', 0),
      passage('https://a.example/', '2026-04-30', 1),
      passage('https://b.example/', '2026-05-01', 2),
    ];
    expect(stalePages(entries, now)).toEqual([
      { url: 'https://a.example/', fetchedAt: '2026-04-30' },
    ]);
  });

  it('lists the oldest first', () => {
    const entries = [
      passage('https://b.example/', '2025-12-01'),
      passage('https://a.example/', '2025-01-01'),
    ];
    expect(stalePages(entries, now).map(({ url }) => url)).toEqual([
      'https://a.example/',
      'https://b.example/',
    ]);
  });
});
