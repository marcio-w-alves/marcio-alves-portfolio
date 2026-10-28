import { describe, expect, it } from 'vitest';
import { profile } from '@/profile';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { findOwnerLiterals, ownerTerms, repositoryFiles } from '@/testing/whitelabel';

/**
 * Owner literals belong in the profile alone. The scan widens as the work
 * moves them there: for now it covers what already left — the record, the
 * retrieval index, the evaluation cases — and the adapters, which name the
 * site through the profile.
 */
const SCOPE = [
  'src/core/knowledge',
  'src/infrastructure',
  'scripts/evaluation',
  'scripts/build-knowledge-index.mts',
  'scripts/build-knowledge-notes.mts',
];

const terms = ownerTerms(profile.identity, profile.knowledge);

describe('owner literals outside the profile', () => {
  it('derives every identifying term from the profile', () => {
    const texts = terms.map((term) => term.text);
    const { identity, knowledge } = profile;
    expect(texts).toEqual(
      expect.arrayContaining([
        identity.name,
        identity.firstName,
        identity.lastName,
        identity.contact.email,
        identity.contact.github,
        identity.contact.linkedin,
        identity.siteHost,
        knowledge.education.school,
        ...knowledge.projects.map((project) => project.name),
        ...knowledge.experience
          .map((role) => role.company)
          .filter((company) => !identity.nonIdentifyingTerms.includes(company)),
      ]),
    );
    for (const kind of ['identity', 'company', 'product', 'school']) {
      expect(
        terms.some((term) => term.kind === kind),
        kind,
      ).toBe(true);
    }
  });

  it('reports a planted literal by file, line, term and kind', () => {
    const { name } = profile.identity;
    const planted = {
      path: 'src/x.ts',
      text: `const a = 1;\nconst b = 2;\nconst who = '${name}';`,
    };
    expect(findOwnerLiterals([planted], terms)).toContain(`src/x.ts:3: "${name}" (identity)`);
  });

  it('matches a term only as a whole word, in its own case', () => {
    const [company] = terms.filter((term) => term.kind === 'company');
    if (!company) throw new Error('the profile names no company');
    const lookalikes = `const x = 'pre${company.text}post ${company.text.toLowerCase()}';`;
    expect(findOwnerLiterals([{ path: 'src/y.ts', text: lookalikes }], [company])).toEqual([]);
  });

  it('finds none where the data moved from', () => {
    const files = repositoryFiles(SCOPE);
    expect(files.length).toBeGreaterThan(10);
    expect(findOwnerLiterals(files, terms)).toEqual([]);
  });

  it('keeps the fictional fixture apart from the owner, so a test of one never passes on the other', () => {
    const owner = new Set(terms.map((term) => term.text));
    const fixtureTerms = [
      fixtureKnowledge.profile.name,
      fixtureKnowledge.profile.firstName,
      fixtureKnowledge.contact.email,
      fixtureKnowledge.contact.github,
      fixtureKnowledge.contact.linkedin,
      fixtureKnowledge.education.school,
      ...fixtureKnowledge.experience.map((role) => role.company),
      ...fixtureKnowledge.projects.map((project) => project.name),
    ];
    expect(fixtureTerms.filter((term) => owner.has(term))).toEqual([]);
  });
});
