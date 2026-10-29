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

describe('the text of a question', () => {
  it('is refused when it holds a lone surrogate, which the model provider would refuse', () => {
    expect(chatRequestSchema.safeParse({ message: 'Hi \ud800' }).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({ ...QUESTION, history: [{ role: 'user', text: '\udc00' }] })
        .success,
    ).toBe(false);
  });

  it('is accepted with emoji and accents, which are whole characters', () => {
    expect(chatRequestSchema.safeParse({ message: 'Olá 👋 — o que ele fez?' }).success).toBe(true);
  });
});
