import { NextResponse, type NextRequest } from 'next/server';
import { HOME_DESTINATION } from './site/locale-routing';

/**
 * Serves the home page from the English segment. A rewrite in next.config
 * did the same for a full page load, but on Vercel a client navigation's data
 * requests for `/` landed on the not-found page (POR-85); a proxy rewrite
 * runs before routing, so Next resolves those requests itself.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = HOME_DESTINATION;
  return NextResponse.rewrite(url);
}

export const config = { matcher: '/' };
