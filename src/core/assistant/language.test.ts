import { describe, expect, it } from 'vitest';
import { detectLanguage, replyLocale } from './language';

describe('the language a question is written in', () => {
  it.each([
    ['Ele já liderou equipes?', 'pt-BR'],
    ['Ele usa React?', 'pt-BR'],
    ['Ação', 'pt-BR'],
    ['Me fale sobre a carreira da Ada.', 'pt-BR'],
    ['Qual é a experiência dele com React e TypeScript?', 'pt-BR'],
    ['Has he led teams?', 'en'],
    ["Tell me about Ada's career.", 'en'],
    ['Does he speak Français?', 'en'],
    ['¿Dónde trabaja?', 'other'],
    ['Donde trabaja?', 'other'],
    ['React?', 'ambiguous'],
    ['Acme', 'ambiguous'],
    ['E-mail?', 'ambiguous'],
    ['', 'ambiguous'],
  ])('reads %j as %s', (question, expected) => {
    expect(detectLanguage(question)).toBe(expected);
  });
});

describe('the language an answer is given in', () => {
  it("follows the question's language, whatever the page", () => {
    expect(replyLocale('Ele já liderou equipes?', 'en')).toBe('pt-BR');
    expect(replyLocale('Has he led teams?', 'pt-BR')).toBe('en');
  });

  it("falls back to the page's language when the question cannot tell", () => {
    expect(replyLocale('React?', 'pt-BR')).toBe('pt-BR');
    expect(replyLocale('React?', 'en')).toBe('en');
  });

  it("uses the page's language around an answer in a language the site does not speak", () => {
    expect(replyLocale('¿Dónde trabaja?', 'pt-BR')).toBe('pt-BR');
  });
});
