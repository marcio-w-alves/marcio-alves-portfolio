import { describe, expect, it } from 'vitest';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import {
  findFigureLiterals,
  findOwnerLiterals,
  findOwnerWords,
  ownerTerms,
  ownerWords,
  recordFigures,
  repositoryFiles,
} from '@/testing/whitelabel';
import { profile } from '@/profile';

/**
 * Owner literals belong in the profile alone. The scan widens as the work
 * moves them there: for now it covers the core — the record's types, the
 * assistant and its answers' engine — what already left for the profile —
 * the retrieval index, the evaluation cases — and the adapters, which name
 * the site through the profile.
 */
const SCOPE = [
  'src/core',
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
      ...fixtureKnowledge.experience.flatMap((role) => [role.company, ...(role.aliases ?? [])]),
      ...fixtureKnowledge.projects.map((project) => project.name),
    ];
    expect(fixtureTerms.filter((term) => owner.has(term))).toEqual([]);
  });
});

describe('owner specifics outside the profile, in the core', () => {
  const core = repositoryFiles(['src/core']);
  const shipped = core.filter(({ path }) => !/\.test\.tsx?$/.test(path));
  const figures = recordFigures(profile.knowledge);
  const words = ownerWords(profile.identity, profile.copy.en.answers.vocabulary);

  it("derives the record's figures and the owner's words from the profile", () => {
    const metricValues = Object.values(profile.knowledge.metrics).map((metric) => metric.value);
    expect(figures).toEqual(expect.arrayContaining(metricValues));
    expect(figures).toContain(String(profile.knowledge.profile.careerStartYear));
    expect(words).toContain(profile.identity.firstName.toLowerCase());
    expect(words.length).toBeGreaterThan(2);
  });

  it('reports a planted figure inside a string, and not one inside a comment', () => {
    const [figure = ''] = figures;
    const planted = {
      path: 'src/core/x.ts',
      text: `// ${figure} in a comment\nconst line = \`cut by ${figure}\`;`,
    };
    expect(findFigureLiterals([planted], [figure])).toEqual([
      `src/core/x.ts:2: "${figure}" (figure)`,
    ]);
  });

  it("reports the owner's word inside an identifier, in any case", () => {
    const planted = { path: 'src/core/y.ts', text: "const a = 1;\nconst payrollRole = 'x';" };
    expect(findOwnerWords([planted], ['payroll'])).toEqual([
      'src/core/y.ts:2: "payroll" (vocabulary)',
    ]);
    expect(findOwnerWords([{ path: 'src/core/z.ts', text: 'payrolls' }], ['payroll'])).toEqual([]);
  });

  it("repeats none of the record's figures in a literal of shipped code", () => {
    expect(shipped.length).toBeGreaterThan(30);
    expect(findFigureLiterals(shipped, figures)).toEqual([]);
  });

  it("uses none of the owner's own words or names, in code or in tests", () => {
    expect(findOwnerWords(core, words)).toEqual([]);
  });
});
