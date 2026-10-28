import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import { createWikipediaReferences } from './wikipedia-references';

const SITE = new URL('https://portfolio.example');

const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/:title';
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** The adapter, with what it logs kept as parsed lines. */
function wikipedia(options: { timeoutMs?: number } = {}) {
  const logged: Record<string, unknown>[] = [];
  const logger = createLogger({
    write: (level, line) => logged.push({ ...(JSON.parse(line) as object), level }),
  });
  return {
    references: createWikipediaReferences({
      product: 'AdaRiveraPortfolio',
      siteUrl: SITE,
      logger,
      ...options,
    }),
    logged,
  };
}

function article(title: string, type = 'standard') {
  return {
    type,
    title,
    extract: `${title} is described here.`,
    content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${title}` } },
  };
}

describe('Wikipedia references', () => {
  it('returns the summary of a standard article, identifying the client as Wikimedia asks', async () => {
    let userAgent: string | null = null;
    let requested = '';
    server.use(
      http.get(SUMMARY, ({ request, params }) => {
        userAgent = request.headers.get('user-agent');
        requested = String(params.title);
        return HttpResponse.json(article('TypeScript'));
      }),
    );
    expect(await wikipedia().references.summary('TypeScript')).toEqual({
      title: 'TypeScript',
      extract: 'TypeScript is described here.',
      url: 'https://en.wikipedia.org/wiki/TypeScript',
    });
    expect(userAgent).toBe('AdaRiveraPortfolio/1.0 (https://portfolio.example)');
    expect(requested).toBe('TypeScript');
  });

  it('asks for the title with underscores, as article paths are written', async () => {
    let requested = '';
    server.use(
      http.get(SUMMARY, ({ params }) => {
        requested = String(params.title);
        return HttpResponse.json(article('React (software)'));
      }),
    );
    await wikipedia().references.summary('React (software)');
    expect(decodeURIComponent(requested)).toBe('React_(software)');
  });

  it('treats a disambiguation page as no article, since it describes nothing', async () => {
    server.use(http.get(SUMMARY, () => HttpResponse.json(article('Mercury', 'disambiguation'))));
    expect(await wikipedia().references.summary('Mercury')).toBeNull();
  });

  it('reports a missing article as unavailable', async () => {
    server.use(http.get(SUMMARY, () => HttpResponse.json({ type: 'not_found' }, { status: 404 })));
    expect(await wikipedia().references.summary('Core Web Vitals')).toBeNull();
  });

  it('gives up on a slow response instead of holding the answer open', async () => {
    server.use(
      http.get(SUMMARY, async () => {
        await delay(500);
        return HttpResponse.json(article('Redis'));
      }),
    );
    const started = Date.now();
    expect(await wikipedia({ timeoutMs: 50 }).references.summary('Redis')).toBeNull();
    expect(Date.now() - started).toBeLessThan(400);
  });

  it('serves a repeated title from cache without asking again', async () => {
    let requests = 0;
    server.use(
      http.get(SUMMARY, () => {
        requests += 1;
        return HttpResponse.json(article('Next.js'));
      }),
    );
    const references = wikipedia().references;
    await references.summary('Next.js');
    await references.summary('Next.js');
    expect(requests).toBe(1);
  });

  it('reads a valid summary and ignores fields it does not use', async () => {
    server.use(
      http.get(SUMMARY, () =>
        HttpResponse.json({ ...article('Redis'), thumbnail: { source: 'x.png' }, lang: 'en' }),
      ),
    );
    const { references, logged } = wikipedia();
    expect(await references.summary('Redis')).toMatchObject({ title: 'Redis' });
    expect(logged).toEqual([]);
  });

  it.each([
    ['a 5xx', () => HttpResponse.json({}, { status: 503 }), { cause: 'status', status: 503 }],
    [
      'a missing article',
      () => HttpResponse.json({ type: 'not_found' }, { status: 404 }),
      { cause: 'status', status: 404 },
    ],
    [
      'a summary of the wrong shape',
      () => HttpResponse.json({ type: 'standard', title: 'Redis', extract: 42 }),
      { cause: 'shape', status: 200 },
    ],
    ['a network error', () => HttpResponse.error(), { cause: 'network', status: null }],
  ])('degrades to unavailable on %s, logging why', async (_label, reply, why) => {
    server.use(http.get(SUMMARY, reply));
    const { references, logged } = wikipedia();

    expect(await references.summary('Redis')).toBeNull();
    expect(logged).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'adapter.degraded',
        adapter: 'wikipedia',
        operation: 'summary',
        ...why,
      }),
    ]);
  });

  it('logs a timeout without the title it looked up', async () => {
    server.use(
      http.get(SUMMARY, async () => {
        await delay('infinite');
        return HttpResponse.json(article('Redis'));
      }),
    );
    const { references, logged } = wikipedia({ timeoutMs: 50 });

    expect(await references.summary('Redis')).toBeNull();
    expect(logged).toEqual([
      expect.objectContaining({ event: 'adapter.degraded', cause: 'timeout', status: null }),
    ]);
    expect(JSON.stringify(logged)).not.toContain('Redis');
  });

  it('logs nothing for a disambiguation page, which is an answer and not a failure', async () => {
    server.use(http.get(SUMMARY, () => HttpResponse.json(article('Mercury', 'disambiguation'))));
    const { references, logged } = wikipedia();
    await references.summary('Mercury');
    expect(logged).toEqual([]);
  });
});
