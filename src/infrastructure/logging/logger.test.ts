import { describe, expect, it, vi } from 'vitest';
import { createClientTagger } from './client-tag';
import { createLogger, errorFields } from './logger';

const NOW = new Date('2026-10-28T12:34:56.789Z');

function recordingLogger() {
  const written: { stream: string; line: string }[] = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    written.push({ stream: 'stdout', line: String(line) });
  });
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    written.push({ stream: 'stderr', line: String(line) });
  });
  return { logger: createLogger({ now: () => NOW }), written };
}

describe('logger', () => {
  it('writes one JSON object per line: level, event, timestamp, then the fields', () => {
    const { logger, written } = recordingLogger();
    logger.info('chat.answered', { path: 'fast', durationMs: 12, cached: false, intent: null });

    expect(written).toHaveLength(1);
    expect(written[0]?.line).toBe(
      '{"level":"info","event":"chat.answered","time":"2026-10-28T12:34:56.789Z",' +
        '"path":"fast","durationMs":12,"cached":false,"intent":null}',
    );
  });

  it('sends information to stdout, and warnings and errors to stderr', () => {
    const { logger, written } = recordingLogger();
    logger.info('a');
    logger.warn('b');
    logger.error('c');
    expect(written.map(({ stream }) => stream)).toEqual(['stdout', 'stderr', 'stderr']);
  });

  it('keeps a multi-line error on one line', () => {
    const { logger, written } = recordingLogger();
    logger.error('assistant.failed', errorFields(new TypeError('first\nsecond')));

    expect(written).toHaveLength(1);
    expect(written[0]?.line).not.toContain('\n');
    expect(JSON.parse(written[0]?.line ?? '')).toMatchObject({
      level: 'error',
      errorName: 'TypeError',
      errorMessage: 'first\nsecond',
      errorStack: expect.stringContaining('TypeError: first') as string,
    });
  });

  it('describes something thrown that is not an Error', () => {
    expect(errorFields('timeout')).toEqual({ errorName: 'NonError', errorMessage: 'timeout' });
  });
});

describe('client tag', () => {
  it('is stable for one visitor and different for another', () => {
    const tag = createClientTagger();
    expect(tag('203.0.113.7')).toBe(tag('203.0.113.7'));
    expect(tag('203.0.113.7')).not.toBe(tag('203.0.113.8'));
  });

  it('cannot be reproduced without the instance’s own key', () => {
    expect(createClientTagger()('203.0.113.7')).not.toBe(createClientTagger()('203.0.113.7'));
  });
});
