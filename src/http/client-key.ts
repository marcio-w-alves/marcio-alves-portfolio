import { isIPv4, isIPv6 } from 'node:net';

const UNKNOWN = 'unknown';
const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/;

/**
 * The address as it identifies a client for pacing and budgeting. An IPv6
 * host is usually handed a whole /64, so a single address there is one of
 * billions the same visitor can rotate through: the /64 is the client. An
 * IPv4-mapped IPv6 address is the IPv4 client it maps.
 */
export function clientKey(raw: string): string {
  const address = bareAddress(raw.trim());
  if (isIPv4(address)) return address;
  if (isIPv6(address)) return keyOfIPv6(hextetsOf(address));
  return UNKNOWN;
}

/**
 * Vercel sets x-real-ip to the connecting client; x-forwarded-for is the
 * fallback elsewhere. Used only to pace requests, never stored or shown.
 * Blank entries are skipped, so an empty header falls through instead of
 * becoming one key shared by everyone who sends it.
 */
export function clientIdOf(request: Request): string {
  const candidates = [
    request.headers.get('x-real-ip') ?? '',
    ...(request.headers.get('x-forwarded-for')?.split(',') ?? []),
  ];
  return clientKey(candidates.find((entry) => entry.trim() !== '') ?? '');
}

/** Without the brackets, port and zone id a header may carry around it. */
function bareAddress(value: string): string {
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end < 0 ? '' : withoutZone(value.slice(1, end));
  }
  const ipv4 = IPV4_WITH_PORT.exec(value)?.[1];
  return ipv4 ?? withoutZone(value);
}

function withoutZone(address: string): string {
  return address.split('%')[0] ?? '';
}

/** The eight 16-bit groups of a valid IPv6 address, with `::` expanded. */
function hextetsOf(address: string): number[] {
  const [head = '', tail] = address.split('::');
  const front = groupsOf(head);
  const back = tail === undefined ? [] : groupsOf(tail);
  return [...front, ...new Array<number>(8 - front.length - back.length).fill(0), ...back];
}

function groupsOf(part: string): number[] {
  if (part === '') return [];
  return part
    .split(':')
    .flatMap((group) => (group.includes('.') ? ipv4Hextets(group) : [parseInt(group, 16)]));
}

function ipv4Hextets(ipv4: string): number[] {
  const [a = 0, b = 0, c = 0, d = 0] = ipv4.split('.').map(Number);
  return [(a << 8) | b, (c << 8) | d];
}

function keyOfIPv6(hextets: readonly number[]): string {
  const isMappedIPv4 = hextets.slice(0, 5).every((group) => group === 0) && hextets[5] === 0xffff;
  if (isMappedIPv4) {
    const [high = 0, low = 0] = hextets.slice(6);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
  }
  return `${hextets
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}
