import { describe, expect, it } from 'vitest';
import { chatRequestSchema } from './request-schema';

const QUESTION = { message: 'What did she do at Globex?' };

describe('the language a question is asked in', () => {
  it("is the page's, as the interface sends it", () => {
    expect(chatRequestSchema.parse({ ...QUESTION, locale: 'pt-BR' }).locale).toBe('pt-BR');
  });

  it('is English when a request names none, as every request did before languages', () => {
    expect(chatRequestSchema.parse(QUESTION).locale).toBe('en');
  });

  it('is refused when the site does not speak it', () => {
    expect(chatRequestSchema.safeParse({ ...QUESTION, locale: 'fr' }).success).toBe(false);
  });
});
