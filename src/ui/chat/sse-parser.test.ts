import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse-parser';

const encoder = new TextEncoder();

/** Feeds each chunk as the network would deliver it, then ends the stream. */
function parse(...chunks: readonly (string | Uint8Array)[]): string[] {
  const parser = createSseParser();
  const frames = chunks.flatMap((chunk) =>
    parser.push(typeof chunk === 'string' ? encoder.encode(chunk) : chunk),
  );
  return [...frames, ...parser.end()];
}

describe('reading server-sent events', () => {
  it('reads frames with CRLF line endings', () => {
    expect(parse('data: a\r\n\r\ndata: b\r\n\r\n')).toEqual(['a', 'b']);
  });

  it('reads frames with lone CR line endings', () => {
    expect(parse('data: a\r\rdata: b\r\r')).toEqual(['a', 'b']);
  });

  it('does not split a frame on a CRLF broken across chunks', () => {
    const parser = createSseParser();

    expect(parser.push(encoder.encode('data: a\r'))).toEqual([]);
    expect(parser.push(encoder.encode('\n\r\n'))).toEqual(['a']);
    expect(parser.end()).toEqual([]);
  });

  it('yields each frame as soon as its blank line arrives', () => {
    const parser = createSseParser();

    expect(parser.push(encoder.encode('data: a\n\ndata: b'))).toEqual(['a']);
    expect(parser.push(encoder.encode('\n\n'))).toEqual(['b']);
  });

  it('reads a final frame with no trailing blank line', () => {
    expect(parse('data: a\n\ndata: b')).toEqual(['a', 'b']);
    expect(parse('data: a\n')).toEqual(['a']);
  });

  it.each(['ã', '€', '😀'])('decodes %s split across byte chunks', (character) => {
    const bytes = encoder.encode(`data: ${character}\n\n`);
    const splitInside = 'data: '.length + 1;

    expect(parse(bytes.slice(0, splitInside), bytes.slice(splitInside))).toEqual([character]);
  });

  it('decodes a character whose bytes arrive one at a time', () => {
    const bytes = encoder.encode('data: “frontend” — 2021\n\n');

    expect(parse(...Array.from(bytes, (byte) => Uint8Array.of(byte)))).toEqual([
      '“frontend” — 2021',
    ]);
  });

  it('joins multi-line data with a newline', () => {
    expect(parse('data: a\ndata: b\n\n')).toEqual(['a\nb']);
  });

  it('strips exactly one leading space from a data value', () => {
    expect(parse('data:x\n\ndata:  x\n\n')).toEqual(['x', ' x']);
  });

  it('dispatches a frame whose data is empty, as the specification says', () => {
    expect(parse('data\n\ndata:\n\n')).toEqual(['', '']);
  });

  it('keeps line separators that only JavaScript treats as line breaks', () => {
    expect(parse('data: a\u2028b\n\n')).toEqual(['a\u2028b']);
  });

  it('ignores a stream of nothing but heartbeats', () => {
    expect(parse(': keep-alive\n\n', ': keep-alive\n\n')).toEqual([]);
  });

  it('ignores comments and fields other than data inside a frame', () => {
    expect(parse(': note\nevent: answer\nid: 7\nretry: 1000\ndata: a\n\n')).toEqual(['a']);
  });
});
