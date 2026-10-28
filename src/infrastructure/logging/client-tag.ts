import { createHmac, randomBytes } from 'node:crypto';

/**
 * A stand-in for the visitor's address in the logs: stable within one server
 * instance, so one visitor's lines can be followed, but keyed with a secret
 * that never leaves memory. A plain hash would not do — every IPv4 address
 * can be hashed in minutes, which turns the hash straight back into the IP.
 */
export function createClientTagger(key: Buffer = randomBytes(32)) {
  return function tagClient(clientId: string): string {
    return createHmac('sha256', key).update(clientId).digest('base64url').slice(0, 16);
  };
}
