import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createWikipediaReferences, USER_AGENT } from './wikipedia-references';

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
    expect(await createWikipediaReferences().summary('TypeScript')).toEqual({
      title: 'TypeScript',
      extract: 'TypeScript is described here.',
      url: 'https://en.wikipedia.org/wiki/TypeScript',
    });
    expect(userAgent).toBe(USER_AGENT);
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
    await createWikipediaReferences().summary('React (software)');
    expect(decodeURIComponent(requested)).toBe('React_(software)');
  });

  it('treats a disambiguation page as no article, since it describes nothing', async () => {
    server.use(http.get(SUMMARY, () => HttpResponse.json(article('Deel', 'disambiguation'))));
    expect(await createWikipediaReferences().summary('Deel')).toBeNull();
  });

  it('reports a missing article as unavailable', async () => {
    server.use(http.get(SUMMARY, () => HttpResponse.json({ type: 'not_found' }, { status: 404 })));
    expect(await createWikipediaReferences().summary('Core Web Vitals')).toBeNull();
  });

  it('gives up on a slow response instead of holding the answer open', async () => {
    server.use(
      http.get(SUMMARY, async () => {
        await delay(500);
        return HttpResponse.json(article('Redis'));
      }),
    );
    const started = Date.now();
    expect(await createWikipediaReferences({ timeoutMs: 50 }).summary('Redis')).toBeNull();
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
    const references = createWikipediaReferences();
    await references.summary('Next.js');
    await references.summary('Next.js');
    expect(requests).toBe(1);
  });
});
