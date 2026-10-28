import { describe, expect, it } from 'vitest';
import { clientIdOf, clientKey } from './client-key';

function request(headers: Record<string, string>): Request {
  return new Request('https://marciomariani.dev/api/chat', { method: 'POST', headers });
}

describe('client key', () => {
  it('groups an IPv6 /64 into one client', () => {
    expect(clientKey('2001:db8:1:2::a')).toBe('2001:db8:1:2::/64');
    expect(clientKey('2001:db8:1:2::b')).toBe(clientKey('2001:db8:1:2::a'));
    expect(clientKey('2001:db8:1:3::a')).not.toBe(clientKey('2001:db8:1:2::a'));
  });

  it.each([
    ['the full form', '2001:0DB8:0001:0002:0000:0000:0000:000a'],
    ['brackets and a port', '[2001:db8:1:2::a]:443'],
    ['brackets alone', '[2001:db8:1:2::a]'],
    ['a zone id', '2001:db8:1:2::a%eth0'],
    ['surrounding blanks', '  2001:db8:1:2:ffff:ffff:ffff:ffff '],
  ])('reads %s as the same /64', (_form, raw) => {
    expect(clientKey(raw)).toBe('2001:db8:1:2::/64');
  });

  it('expands a compressed run before taking the prefix', () => {
    expect(clientKey('::1')).toBe('0:0:0:0::/64');
    expect(clientKey('2001:db8::1:2:3:4')).toBe('2001:db8:0:0::/64');
    expect(clientKey('2001:db8:1:2:3::')).toBe('2001:db8:1:2::/64');
  });

  it.each([
    ['an IPv4 address', '203.0.113.7'],
    ['an IPv4 address with a port', '203.0.113.7:51234'],
    ['an IPv4-mapped IPv6 address', '::ffff:203.0.113.7'],
    ['an IPv4-mapped IPv6 address in hex', '::ffff:cb00:7107'],
    ['an IPv4-mapped IPv6 address in brackets with a port', '[::ffff:203.0.113.7]:443'],
  ])('reads %s as the IPv4 client', (_form, raw) => {
    expect(clientKey(raw)).toBe('203.0.113.7');
  });

  it.each(['', '   ', 'garbage', '999.0.0.1', '2001:db8::1::2', '[2001:db8::1'])(
    'calls %j an unknown client',
    (raw) => {
      expect(clientKey(raw)).toBe('unknown');
    },
  );
});

describe('client of a request', () => {
  it('reads the client from x-real-ip first', () => {
    const client = clientIdOf(
      request({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }),
    );
    expect(client).toBe('203.0.113.7');
  });

  it('falls back to the first non-blank forwarded entry', () => {
    const client = clientIdOf(
      request({ 'x-real-ip': ' ', 'x-forwarded-for': ' , 2001:db8:1:2::a, 198.51.100.1' }),
    );
    expect(client).toBe('2001:db8:1:2::/64');
  });

  it('calls a request with no usable address an unknown client', () => {
    expect(clientIdOf(request({ 'x-forwarded-for': ' , ' }))).toBe('unknown');
    expect(clientIdOf(request({}))).toBe('unknown');
  });
});
