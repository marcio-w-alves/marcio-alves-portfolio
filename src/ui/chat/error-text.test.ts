import { describe, expect, it } from 'vitest';
import { errorText } from './error-text';

describe('the text of a failed answer', () => {
  it('rounds the wait up to whole minutes', () => {
    expect(errorText({ code: 'rate_limited', retryable: true, retryAfterSeconds: 61 })).toBe(
      'Too many questions in a short time. Try again in 2 minutes.',
    );
    expect(errorText({ code: 'rate_limited', retryable: true, retryAfterSeconds: 60 })).toBe(
      'Too many questions in a short time. Try again in 1 minute.',
    );
  });

  it('asks for a few minutes when the server did not say how long', () => {
    expect(errorText({ code: 'rate_limited', retryable: true })).toBe(
      'Too many questions in a short time. Try again in a few minutes.',
    );
  });

  it('tells a question too long to send from a failure on the server', () => {
    expect(errorText({ code: 'rejected', retryable: false })).toBe(
      'That question could not be sent. Try a shorter one.',
    );
    expect(errorText({ code: 'internal', retryable: true })).toBe(
      'Something failed on our side. Please try again.',
    );
  });
});
