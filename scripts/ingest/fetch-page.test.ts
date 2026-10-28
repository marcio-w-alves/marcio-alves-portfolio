import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchPage, MAX_PAGE_BYTES, type PageFetchOptions } from './fetch-page';

const PAGE = 'https://pipewright.example/';

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

const options: PageFetchOptions = {
  // Looked up per call: the server replaces the global fetch only once it listens.
  fetch: (input, init) => fetch(input, init),
  userAgent: 'AdaRiveraPortfolio-ingest/1.0',
  timeoutMs: 50,
  retryDelayMs: 2000,
  wait: () => Promise.resolve(),
  isAllowed: (url) => !url.includes('/private'),
};

function redirect(to: string) {
  return new HttpResponse(null, { status: 301, headers: { location: to } });
}

function html(body: string) {
  return new HttpResponse(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

describe('fetching an allow-listed page', () => {
  it('follows a redirect within its own origin and returns the HTML', async () => {
    server.use(
      http.get(PAGE, () => redirect('/home')),
      http.get('https://pipewright.example/home', () => html('<p>Olá, Pipewright</p>')),
    );
    await expect(fetchPage(PAGE, options)).resolves.toBe('<p>Olá, Pipewright</p>');
  });

  it.each([
    [
      'a redirect to another origin',
      () => [http.get(PAGE, () => redirect('https://tracker.example/landing'))],
      'https://pipewright.example/: redirects to another origin (https://tracker.example/landing)',
    ],
    [
      'a fourth redirect within its origin',
      () => [
        http.get(PAGE, () => redirect('/1')),
        http.get('https://pipewright.example/:step', ({ params }) =>
          redirect(`/${String(Number(params.step) + 1)}`),
        ),
      ],
      'https://pipewright.example/: more than 3 redirects',
    ],
    [
      'a redirect to a path robots.txt disallows',
      () => [http.get(PAGE, () => redirect('/private/page'))],
      'https://pipewright.example/: redirects to https://pipewright.example/private/page, which robots.txt disallows',
    ],
    [
      'a PDF',
      () => [
        http.get(PAGE, () =>
          HttpResponse.arrayBuffer(new ArrayBuffer(8), {
            headers: { 'content-type': 'application/pdf' },
          }),
        ),
      ],
      'https://pipewright.example/: is application/pdf, not an HTML page',
    ],
    [
      'a body over 2 MB',
      () => [http.get(PAGE, () => html('x'.repeat(MAX_PAGE_BYTES + 1)))],
      'https://pipewright.example/: larger than 2097152 bytes',
    ],
    [
      'a page that does not answer in time',
      () => [
        http.get(PAGE, async () => {
          await delay('infinite');
          return html('');
        }),
      ],
      'https://pipewright.example/: no complete response within 50 ms',
    ],
  ])('refuses %s, naming the page', async (_case, handlers, message) => {
    server.use(...handlers());
    await expect(fetchPage(PAGE, options)).rejects.toThrow(message);
  });

  it('accepts a body of exactly 2 MB', async () => {
    server.use(http.get(PAGE, () => html('x'.repeat(MAX_PAGE_BYTES))));
    await expect(fetchPage(PAGE, options)).resolves.toHaveLength(MAX_PAGE_BYTES);
  });

  it('retries once after a dropped connection, waiting first', async () => {
    let attempts = 0;
    const waits: number[] = [];
    server.use(
      http.get(PAGE, () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.error() : html('<p>back</p>');
      }),
    );

    const page = await fetchPage(PAGE, {
      ...options,
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });

    expect(page).toBe('<p>back</p>');
    expect(attempts).toBe(2);
    expect(waits).toEqual([2000]);
  });

  it('does not retry a page that timed out', async () => {
    let attempts = 0;
    server.use(
      http.get(PAGE, async () => {
        attempts += 1;
        await delay('infinite');
        return html('');
      }),
    );
    await expect(fetchPage(PAGE, options)).rejects.toThrow('no complete response');
    expect(attempts).toBe(1);
  });
});
