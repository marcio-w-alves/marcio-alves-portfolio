import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildContainer } from '../../../src/composition-root';
import type { AnswerSet } from '../../../src/core/assistant/answer-set';
import type { Translations } from '../../../src/core/i18n/locale';
import { assistantSettings } from '../../../src/env';
import { createChatHandler } from '../../../src/http/chat-handler';
import { createHealthHandler } from '../../../src/http/health-handler';
import {
  fixtureAnswers,
  fixtureKnowledge,
  fixturePortugueseAnswers,
} from '../../../src/testing/fixture-profile';

/**
 * A real HTTP server on 127.0.0.1 in front of the site's own chat and health
 * handlers, wired to the fictional profile without a model — what a local
 * build serves to the capture — plus fixed files for the route tests.
 */

export interface StaticRoute {
  readonly body: Uint8Array;
  readonly contentType: string;
  /** Answers with a redirect there instead of the body. */
  readonly redirectTo?: string;
}

export interface SiteServerOptions {
  readonly answers?: Translations<AnswerSet>;
  readonly files?: Readonly<Record<string, StaticRoute>>;
}

export interface SiteServer {
  readonly url: URL;
  readonly close: () => Promise<void>;
}

export const FIXTURE_ANSWERS: Translations<AnswerSet> = {
  en: fixtureAnswers,
  'pt-BR': fixturePortugueseAnswers,
};

export async function startSiteServer({
  answers = FIXTURE_ANSWERS,
  files = {},
}: SiteServerOptions = {}): Promise<SiteServer> {
  const container = buildContainer({
    record: fixtureKnowledge,
    answers,
    env: { OPENAI_API_KEY: undefined, GITHUB_TOKEN: undefined },
    settings: { ...assistantSettings(), requestsPerTenMinutes: 100_000 },
  });
  const chat = createChatHandler(container);
  const health = createHealthHandler(container);
  const handle = async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/chat') return chat(request);
    if (pathname === '/api/health') return health();
    const file = files[pathname];
    if (!file) return new Response('not found', { status: 404 });
    if (file.redirectTo)
      return new Response(null, { status: 308, headers: { location: file.redirectTo } });
    return new Response(new Uint8Array(file.body), {
      headers: { 'content-type': file.contentType },
    });
  };
  const server = createServer((incoming, outgoing) => {
    void serve(incoming, outgoing, handle);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: new URL(`http://127.0.0.1:${String(port)}`),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function serve(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  handle: (request: Request) => Promise<Response>,
) {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const request = new Request(`http://127.0.0.1${incoming.url ?? '/'}`, {
    method: incoming.method ?? 'GET',
    headers: Object.entries(incoming.headers).flatMap(([name, value]): [string, string][] =>
      typeof value === 'string' ? [[name, value]] : [],
    ),
    ...(chunks.length > 0 ? { body: Buffer.concat(chunks) } : {}),
  });
  const response = await handle(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}
