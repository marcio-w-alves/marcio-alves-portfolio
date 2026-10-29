import { createServer, type Server, type Socket } from 'node:net';

/**
 * Two servers a build must not be fooled by: one that accepts a connection and
 * then says nothing at all, and one that answers the client's request for TLS
 * with "no".
 */

export interface FakeServer {
  readonly url: (user?: string) => string;
  readonly connections: () => number;
  readonly close: () => Promise<void>;
}

async function listening(server: Server, onConnection: (socket: Socket) => void): Promise<number> {
  server.on('connection', onConnection);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('The server has no port.');
  return address.port;
}

async function fakeServer(onConnection: (socket: Socket) => void): Promise<FakeServer> {
  let connections = 0;
  const open = new Set<Socket>();
  const server = createServer();
  const port = await listening(server, (socket) => {
    connections += 1;
    open.add(socket);
    socket.on('close', () => open.delete(socket));
    // A socket nobody reads from stays paused, and a paused socket never
    // notices that the other end has gone.
    socket.resume();
    onConnection(socket);
  });
  return {
    url: (user = 'profile_reader') => `postgres://${user}:secret@localhost:${String(port)}/profile`,
    connections: () => connections,
    close: () =>
      new Promise((resolve) => {
        for (const socket of open) socket.destroy();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** Accepts the connection and never answers: the case a timeout exists for. */
export function blackHole(): Promise<FakeServer> {
  return fakeServer(() => undefined);
}

/**
 * Answers the Postgres SSL request with 'N'. A client that falls back to a
 * plain connection here would send its password in the clear.
 */
export function withoutTls(): Promise<FakeServer> {
  return fakeServer((socket) => {
    socket.on('data', () => socket.write('N'));
  });
}
