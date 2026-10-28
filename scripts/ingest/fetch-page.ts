import { PageError, reasonOf, TransientPageError } from './errors';

export const MAX_REDIRECTS = 3;
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;

export interface PageFetchOptions {
  readonly fetch: typeof fetch;
  readonly userAgent: string;
  /** For each request, redirects included, from sending it to the end of its body. */
  readonly timeoutMs: number;
  readonly retryDelayMs: number;
  readonly wait: (ms: number) => Promise<void>;
  /** Whether robots.txt lets a redirect's target be fetched. */
  readonly isAllowed: (url: string) => boolean;
}

/**
 * Fetches one allow-listed page the way a polite, careful crawler does: a
 * time limit, redirects only within the page's own origin, HTML only, a size
 * cap counted as the body arrives, and one retry after a failure that may be
 * temporary. Anything else is refused with an error naming the page.
 */
export async function fetchPage(url: string, options: PageFetchOptions): Promise<string> {
  try {
    return await attempt(url, options);
  } catch (error) {
    if (!(error instanceof TransientPageError)) throw error;
    await options.wait(options.retryDelayMs);
    return attempt(url, options);
  }
}

async function attempt(url: string, options: PageFetchOptions): Promise<string> {
  try {
    return await followRedirects(url, options);
  } catch (error) {
    if (error instanceof PageError) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new PageError(`${url}: no complete response within ${String(options.timeoutMs)} ms`);
    }
    throw new TransientPageError(`${url}: network error (${reasonOf(error)})`, { cause: error });
  }
}

async function followRedirects(url: string, options: PageFetchOptions): Promise<string> {
  let current = url;
  for (let redirects = 0; ; redirects += 1) {
    const response = await options.fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': options.userAgent, accept: 'text/html' },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!isRedirect(response.status)) return readHtml(url, response);
    if (redirects === MAX_REDIRECTS) {
      throw new PageError(`${url}: more than ${String(MAX_REDIRECTS)} redirects`);
    }
    current = redirectTarget(url, current, response);
    if (!options.isAllowed(current)) {
      throw new PageError(`${url}: redirects to ${current}, which robots.txt disallows`);
    }
  }
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function redirectTarget(url: string, current: string, response: Response): string {
  const location = response.headers.get('location');
  if (!location) throw new PageError(`${url}: redirects without saying where`);
  const target = new URL(location, current);
  if (target.origin !== new URL(url).origin) {
    throw new PageError(`${url}: redirects to another origin (${target.href})`);
  }
  return target.href;
}

async function readHtml(url: string, response: Response): Promise<string> {
  if (response.status >= 500) {
    throw new TransientPageError(`${url}: answered ${String(response.status)}`);
  }
  if (!response.ok) throw new PageError(`${url}: answered ${String(response.status)}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('text/html')) {
    throw new PageError(`${url}: is ${type || 'of no declared type'}, not an HTML page`);
  }
  return new TextDecoder(charsetOf(type)).decode(await cappedBody(url, response));
}

function charsetOf(contentType: string): string {
  return /charset=([^;]+)/i.exec(contentType)?.[1]?.trim() ?? 'utf-8';
}

/** The body, counted as it arrives: a page that keeps sending is cut off, not buffered. */
async function cappedBody(url: string, response: Response): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.byteLength;
    if (size > MAX_PAGE_BYTES) {
      throw new PageError(`${url}: larger than ${String(MAX_PAGE_BYTES)} bytes`);
    }
    chunks.push(chunk);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
