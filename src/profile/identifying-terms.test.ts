import { describe, expect, it } from 'vitest';
import { fixtureAnswers, fixtureIdentity, fixtureKnowledge } from '@/testing/fixture-profile';
import { ownerTerms, ownerWords } from './identifying-terms';

/**
 * The terms that identify a profile's person are derived from the profile:
 * for the fictional fixture, exactly its name, contact handles, site,
 * employers, products and school, and its own words.
 */

describe("a profile's identifying terms", () => {
  it('are its identity, employers with their aliases, products and school, each with its kind', () => {
    const { name, firstName, lastName, contact, siteHost, userAgentProduct } = fixtureIdentity;
    const { experience, projects, education } = fixtureKnowledge;
    const handle = (url: string) => url.split('/').at(-1);

    const expected = [
      ...[name, firstName, lastName, contact.email, contact.linkedin, contact.github]
        .concat([
          handle(contact.linkedin) ?? '',
          handle(contact.github) ?? '',
          siteHost,
          userAgentProduct,
        ])
        .map((text) => ({ text, kind: 'identity' })),
      ...experience.flatMap(({ company, aliases = [] }) =>
        [company, ...aliases].map((text) => ({ text, kind: 'company' })),
      ),
      ...projects.map(({ name: product }) => ({ text: product, kind: 'product' })),
      { text: education.school, kind: 'school' },
      { text: education.schoolShort, kind: 'school' },
    ];

    // Each once: the LinkedIn and GitHub handles of the fixture are the same word.
    expect(ownerTerms(fixtureIdentity, fixtureKnowledge)).toEqual([
      ...new Map(expected.map((term) => [term.text, term])).values(),
    ]);
  });

  it('leave out the names the profile marks as ordinary words', () => {
    const [role] = fixtureKnowledge.experience;
    if (!role) throw new Error('The fixture has no role.');
    const identity = { ...fixtureIdentity, nonIdentifyingTerms: [role.company] };

    const terms = ownerTerms(identity, fixtureKnowledge).map(({ text }) => text);
    const words = ownerWords(identity, fixtureKnowledge, fixtureAnswers.vocabulary);

    expect(terms).not.toContain(role.company);
    expect(words).not.toContain(role.id);
  });

  it("include the person's names, the record's ids and the vocabulary's words, lowercased", () => {
    const words = ownerWords(fixtureIdentity, fixtureKnowledge, fixtureAnswers.vocabulary);
    const ids = [...fixtureKnowledge.experience, ...fixtureKnowledge.projects].map(({ id }) => id);

    expect(words).toEqual(
      expect.arrayContaining([
        fixtureIdentity.firstName.toLowerCase(),
        fixtureIdentity.lastName.toLowerCase(),
        ...ids,
      ]),
    );
    expect(words.every((word) => word === word.toLowerCase())).toBe(true);
  });
});
