/**
 * Reads Server-Sent Events out of a byte stream, as the specification
 * defines them: any of CRLF, LF or CR ends a line, a blank line ends a frame,
 * and only `data` matters here — comments (the server's heartbeats) and
 * other fields are skipped. Bytes arrive in arbitrary chunks, so a character,
 * a CRLF or a frame may be split across them.
 */
export interface SseParser {
  /** The data of every frame the chunk completed. */
  push(chunk: Uint8Array): string[];
  /** The data of a last frame the stream ended without a blank line after. */
  end(): string[];
}

// The `s` flag lets the value hold U+2028 and U+2029, which JSON leaves unescaped.
const DATA_LINE = /^data(?:: ?(.*))?$/s;

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/** A frame's data lines joined with `\n`, or null when it has none. */
function dataOf(frame: string): string | null {
  const values = frame
    .split('\n')
    .map((line) => DATA_LINE.exec(line))
    .filter((match) => match !== null)
    .map((match) => match[1] ?? '');
  return values.length > 0 ? values.join('\n') : null;
}

export function createSseParser(): SseParser {
  const decoder = new TextDecoder();
  let buffered = '';
  // A CR ending a chunk may be the first half of a CRLF: wait for the next byte.
  let heldCarriageReturn = '';

  function completeFrames(): string[] {
    const frames = buffered.split('\n\n');
    buffered = frames.pop() ?? '';
    return frames.map(dataOf).filter((data) => data !== null);
  }

  function append(text: string): void {
    const raw = heldCarriageReturn + text;
    heldCarriageReturn = raw.endsWith('\r') ? '\r' : '';
    buffered += normalizeLineEndings(heldCarriageReturn ? raw.slice(0, -1) : raw);
  }

  return {
    push(chunk) {
      append(decoder.decode(chunk, { stream: true }));
      return completeFrames();
    },
    end() {
      buffered += `${normalizeLineEndings(heldCarriageReturn + decoder.decode())}\n\n`;
      heldCarriageReturn = '';
      return completeFrames();
    },
  };
}
