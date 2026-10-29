import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { promptSubject, systemPrompt } from './system-prompt';

const prompt = systemPrompt(
  new Date('2026-10-28T12:00:00Z'),
  promptSubject(localize(fixtureKnowledge, 'en')),
  'en',
);

describe('the system prompt', () => {
  it("forbids presenting a product site's claims as what the person built or achieved", () => {
    expect(prompt).toContain(
      "Passages from a product's or a company's public website describe what the product or the company does, in the site's own words. Never present them as what Ada Rivera built, decided or achieved, and never turn the site's figures or testimonials into his results.",
    );
  });

  it('limits his role on a product to what his record states, and says so when it does not', () => {
    expect(prompt).toContain(
      'His role on a product is only what his record states; if it does not state it, say his specific role is not documented.',
    );
  });

  it.each([
    ['en', 'English'],
    ['pt-BR', 'Brazilian Portuguese'],
  ] as const)(
    "replies in the visitor's language, breaking a tie with the %s page's",
    (locale, language) => {
      const onPage = systemPrompt(
        new Date('2026-10-28T12:00:00Z'),
        promptSubject(localize(fixtureKnowledge, 'en')),
        locale,
      );
      expect(onPage).toContain(
        `The visitor is reading the ${language} version of the site. Reply in the language of the visitor's latest message — including when you decline. When that language cannot be told (a single word, a name, a technology), reply in ${language}.`,
      );
    },
  );

  it('counts what the products and companies do, from their sites, as in scope', () => {
    expect(prompt).toContain(
      'what his products and those companies do according to their public websites',
    );
  });
});
