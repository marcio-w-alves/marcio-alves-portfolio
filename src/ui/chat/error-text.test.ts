import { describe, expect, it } from 'vitest';
import { englishUiMessages } from '../i18n/en';
import { errorText } from './error-text';

const { errors } = englishUiMessages;

describe('the text of a failed answer', () => {
  it('rounds the wait up to whole minutes, in the plural form the count takes', () => {
    expect(
      errorText({ code: 'rate_limited', retryable: true, retryAfterSeconds: 61 }, errors, 'en'),
    ).toBe('Too many questions in a short time. Try again in 2 minutes.');
    expect(
      errorText({ code: 'rate_limited', retryable: true, retryAfterSeconds: 60 }, errors, 'en'),
    ).toBe('Too many questions in a short time. Try again in 1 minute.');
  });

  it("uses the locale's plural rules, which differ from English for some counts", () => {
    const counted = { ...errors, rateLimited: '{retry}', retryIn: { one: 'one', other: 'other' } };
    const wait = (locale: string, minutes: number) =>
      errorText(
        { code: 'rate_limited', retryable: true, retryAfterSeconds: minutes * 60 },
        counted,
        locale,
      );
    expect([wait('en', 1), wait('en', 2)]).toEqual(['one', 'other']);
    expect([wait('fr', 1), wait('fr', 2)]).toEqual(['one', 'other']);
    expect(wait('ja', 1)).toBe('other');
  });

  it('asks for a few minutes when the server did not say how long', () => {
    expect(errorText({ code: 'rate_limited', retryable: true }, errors, 'en')).toBe(
      'Too many questions in a short time. Try again in a few minutes.',
    );
  });

  it('tells a question too long to send from a failure on the server', () => {
    expect(errorText({ code: 'rejected', retryable: false }, errors, 'en')).toBe(
      'That question could not be sent. Try a shorter one.',
    );
    expect(errorText({ code: 'internal', retryable: true }, errors, 'en')).toBe(
      'Something failed on our side. Please try again.',
    );
  });

  it('reads the text from the catalog it is given', () => {
    const reworded = { ...errors, network: 'Offline.' };
    expect(errorText({ code: 'network', retryable: true }, reworded, 'en')).toBe('Offline.');
  });
});
