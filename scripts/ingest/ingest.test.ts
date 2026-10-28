import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SiteEntry } from '../../src/profile/schema';
import { ingestSites, type IngestOptions } from './ingest';

const UA = 'AdaRiveraPortfolio-ingest/1.0 (+https://ada.example)';

const server = setupServer();
const requested: string[] = [];
server.events.on('request:start', ({ request }) => {
  requested.push(request.url);
});

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  requested.length = 0;
});
afterAll(() => {
  server.close();
});

const PARAGRAPHS = [
  'Pipewright rebuilds only the targets a change affects, so a monorepo build finishes in seconds instead of hours.',
  'Every step is cached remotely and shared across the whole team, which means nobody builds the same thing twice.',
  'It runs on the CI you already have and needs no new servers: install the runner, point it at the repository and push.',
];

function articleHtml(paragraphs: readonly string[] = PARAGRAPHS, lang = 'en'): string {
  return `<!doctype html><html lang="${lang}"><head><title>Pipewright</title></head><body>
    <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
    <main><article><h1>Builds that only do what changed</h1>${paragraphs.map((text) => `<p>${text}</p>`).join('')}</article></main>
    <footer><p>© Pipewright</p></footer>
  </body></html>`;
}

function html(body: string) {
  return new HttpResponse(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function robots(text: string) {
  return new HttpResponse(text, { headers: { 'content-type': 'text/plain' } });
}

const pipewright: SiteEntry = {
  subject: { kind: 'project', id: 'pipewright' },
  urls: ['https://pipewright.example/', 'https://pipewright.example/about'],
  termsNote: "Ada's own product.",
};
const acme: SiteEntry = {
  subject: { kind: 'company', id: 'acme' },
  urls: ['https://www.acme.example/about'],
  termsNote: 'Company page.',
};

function options(overrides: Partial<IngestOptions> = {}) {
  const waits: number[] = [];
  return {
    waits,
    options: {
      fetch,
      userAgent: UA,
      wait: (ms: number) => {
        waits.push(ms);
        return Promise.resolve();
      },
      now: new Date('2026-10-28T09:00:00Z'),
      fallbackLanguage: 'en',
      timeouts: { robotsMs: 50, pageMs: 50 },
      ...overrides,
    } satisfies IngestOptions,
  };
}

describe('ingesting the allow-listed sites', () => {
  it('fetches only the allow-listed pages and each origin’s robots.txt, as itself', async () => {
    const agents = new Set<string | null>();
    server.use(
      http.get('https://pipewright.example/robots.txt', () => robots('User-agent: *\nAllow: /')),
      http.get(
        'https://www.acme.example/robots.txt',
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get('https://pipewright.example/', ({ request }) => {
        agents.add(request.headers.get('user-agent'));
        return html(articleHtml());
      }),
      http.get('https://pipewright.example/about', () =>
        html(articleHtml(PARAGRAPHS.map((text) => `About: ${text}`))),
      ),
      http.get('https://www.acme.example/about', () =>
        html(
          articleHtml(
            PARAGRAPHS.map((text) => `Acme: ${text}`),
            'pt-BR',
          ),
        ),
      ),
    );

    const { snapshot, report } = await ingestSites([pipewright, acme], options().options);

    expect(requested.sort()).toEqual([
      'https://pipewright.example/',
      'https://pipewright.example/about',
      'https://pipewright.example/robots.txt',
      'https://www.acme.example/about',
      'https://www.acme.example/robots.txt',
    ]);
    expect(agents).toEqual(new Set([UA]));
    expect(report.skipped).toEqual([]);
    expect(report.ingested.map(({ url }) => url)).toEqual([
      'https://pipewright.example/',
      'https://pipewright.example/about',
      'https://www.acme.example/about',
    ]);
    expect(snapshot.generatedAt).toBe('2026-10-28');
    expect(
      snapshot.entries.map(({ id, url, language, fetchedAt }) => [id, url, language, fetchedAt]),
    ).toEqual([
      ['site/pipewright/0', 'https://pipewright.example/', 'en', '2026-10-28'],
      ['site/pipewright/1', 'https://pipewright.example/about', 'en', '2026-10-28'],
      ['site/acme/0', 'https://www.acme.example/about', 'pt', '2026-10-28'],
    ]);
    expect(snapshot.entries[0]?.text).toContain(PARAGRAPHS[1]);
    expect(snapshot.entries[0]?.text).not.toContain('Pricing');
  });

  it('skips a page robots.txt disallows for this crawler, and reports it', async () => {
    server.use(
      http.get('https://pipewright.example/robots.txt', () =>
        robots(
          'User-agent: AdaRiveraPortfolio-ingest\nDisallow: /about\n\nUser-agent: *\nAllow: /',
        ),
      ),
      http.get('https://pipewright.example/', () => html(articleHtml())),
    );

    const { snapshot, report } = await ingestSites([pipewright], options().options);

    expect(requested).not.toContain('https://pipewright.example/about');
    expect(report.skipped).toEqual([
      {
        url: 'https://pipewright.example/about',
        reason: 'https://pipewright.example/about: robots.txt disallows it',
      },
    ]);
    expect(snapshot.entries.map(({ url }) => url)).toEqual(['https://pipewright.example/']);
  });

  it('crawls nothing on an origin whose robots.txt fails or does not answer', async () => {
    server.use(
      http.get(
        'https://pipewright.example/robots.txt',
        () => new HttpResponse(null, { status: 500 }),
      ),
      http.get('https://www.acme.example/robots.txt', async () => {
        await delay('infinite');
        return robots('');
      }),
    );

    const { snapshot, report } = await ingestSites([pipewright, acme], options().options);

    expect(requested.sort()).toEqual([
      'https://pipewright.example/robots.txt',
      'https://www.acme.example/robots.txt',
    ]);
    expect(snapshot.entries).toEqual([]);
    expect(report.skipped.map(({ url }) => url)).toEqual([...pipewright.urls, ...acme.urls]);
    expect(report.skipped[0]?.reason).toMatch(/robots\.txt unavailable.*answered 500/);
    expect(report.skipped[2]?.reason).toMatch(/robots\.txt unavailable.*could not be read/);
  });

  it('waits at least a second before each page, longer when robots.txt asks for it', async () => {
    server.use(
      http.get('https://pipewright.example/robots.txt', () =>
        robots('User-agent: *\nCrawl-delay: 3\nAllow: /'),
      ),
      http.get('https://www.acme.example/robots.txt', () => robots('User-agent: *\nAllow: /')),
      http.get('https://pipewright.example/*', () => html(articleHtml())),
      http.get('https://www.acme.example/about', () => html(articleHtml())),
    );
    const { waits, options: polite } = options();

    await ingestSites([pipewright, acme], polite);

    expect(waits).toEqual([3000, 3000, 1000]);
  });

  it('retries a page once on a server error, never on a client error', async () => {
    const attempts: Record<string, number> = {};
    const count = (url: string) => (attempts[url] = (attempts[url] ?? 0) + 1);
    server.use(
      http.get('https://pipewright.example/robots.txt', () => robots('User-agent: *\nAllow: /')),
      http.get('https://pipewright.example/', ({ request }) =>
        count(request.url) === 1 ? new HttpResponse(null, { status: 503 }) : html(articleHtml()),
      ),
      http.get('https://pipewright.example/about', ({ request }) => {
        count(request.url);
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const { waits, options: retrying } = options();

    const { report } = await ingestSites([pipewright], retrying);

    expect(attempts).toEqual({
      'https://pipewright.example/': 2,
      'https://pipewright.example/about': 1,
    });
    expect(waits).toEqual([1000, 2000, 1000]);
    expect(report.ingested.map(({ url }) => url)).toEqual(['https://pipewright.example/']);
    expect(report.skipped).toEqual([
      {
        url: 'https://pipewright.example/about',
        reason: 'https://pipewright.example/about: answered 404',
      },
    ]);
  });

  it('gives up on a page that fails twice with a server error, reporting it', async () => {
    let attempts = 0;
    server.use(
      http.get('https://www.acme.example/robots.txt', () => robots('User-agent: *\nAllow: /')),
      http.get('https://www.acme.example/about', () => {
        attempts += 1;
        return new HttpResponse(null, { status: 502 });
      }),
    );

    const { snapshot, report } = await ingestSites([acme], options().options);

    expect(attempts).toBe(2);
    expect(snapshot.entries).toEqual([]);
    expect(report.skipped).toEqual([
      {
        url: 'https://www.acme.example/about',
        reason: 'https://www.acme.example/about: answered 502',
      },
    ]);
  });

  it('skips a page that renders client-side instead of storing its menu labels', async () => {
    server.use(
      http.get('https://www.acme.example/robots.txt', () => robots('User-agent: *\nAllow: /')),
      http.get('https://www.acme.example/about', () =>
        html('<html><body><div id="root"></div><script src="/app.js"></script></body></html>'),
      ),
    );

    const { report } = await ingestSites([acme], options().options);

    expect(report.skipped[0]?.reason).toMatch(
      /^https:\/\/www\.acme\.example\/about: only \d+ characters of readable text; it renders client-side/,
    );
  });
});
