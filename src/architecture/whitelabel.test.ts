import { describe, expect, it } from 'vitest';
import { fixtureIdentity, fixtureKnowledge } from '@/testing/fixture-profile';
import {
  findFigureLiterals,
  findOwnerLiterals,
  findOwnerWords,
  recordFigures,
  repositoryFiles,
  type SourceFile,
} from '@/testing/whitelabel';
import { ownerTerms, ownerWords } from '@/profile/identifying-terms';
// The profile on disk, never the one a test run binds in its place: this
// checks the files a fork keeps against the profile it actually ships.
import { profile } from '../profile';

/**
 * Owner literals belong in the profile alone. Everything else a fork keeps —
 * the code, its tests, the scripts, the end-to-end journeys and the public
 * files — must hold for anyone's profile, so it reads the owner from there.
 */
const SCOPE = ['src', 'scripts', 'e2e', 'public', 'profiles'];
const OWNED = /^src\/(profile|testing\/fixture-profile)\//;

const outsideProfile = repositoryFiles(SCOPE).filter(({ path }) => !OWNED.test(path));

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

  it('reports a term that follows an escape sequence inside a string', () => {
    const [company] = terms.filter((term) => term.kind === 'company');
    if (!company) throw new Error('the profile names no company');
    const planted = { path: 'src/e.ts', text: `const text = 'a.\\n${company.text} b';` };
    expect(findOwnerLiterals([planted], [company])).toEqual([
      `src/e.ts:1: "${company.text}" (company)`,
    ]);
  });

  it('matches a term only as a whole word, in its own case', () => {
    const [company] = terms.filter((term) => term.kind === 'company');
    if (!company) throw new Error('the profile names no company');
    const lookalikes = `const x = 'pre${company.text}post ${company.text.toLowerCase()}';`;
    expect(findOwnerLiterals([{ path: 'src/y.ts', text: lookalikes }], [company])).toEqual([]);
  });

  it('finds none anywhere outside the profile and the fictional fixture', () => {
    expect(outsideProfile.length).toBeGreaterThan(200);
    expect(outsideProfile.some(({ path }) => path.startsWith('e2e/'))).toBe(true);
    expect(findOwnerLiterals(outsideProfile, terms)).toEqual([]);
  });

  it('keeps the fictional fixture apart from the owner, so a test of one never passes on the other', () => {
    const owner = new Set(terms.map((term) => term.text));
    const fixtureTerms = ownerTerms(fixtureIdentity, fixtureKnowledge).map((term) => term.text);
    expect(fixtureTerms.length).toBeGreaterThan(5);
    expect(fixtureTerms.filter((term) => owner.has(term))).toEqual([]);
  });
});

/** Every `#rrggbb` written in a file, lowercased. */
function hexColours({ text }: SourceFile): string[] {
  return (text.match(/#[0-9a-f]{6}\b/gi) ?? []).map((hex) => hex.toLowerCase());
}

describe('the brand colours outside the profile', () => {
  const brandColours = new Set<string>(Object.values(profile.brand.colors));

  it('finds a planted copy of a brand colour', () => {
    const [colour = ''] = brandColours;
    const planted = { path: 'src/ui/x.css', text: `.x { color: ${colour.toUpperCase()}; }` };
    expect(hexColours(planted).filter((hex) => brandColours.has(hex))).toEqual([colour]);
  });

  it('are written nowhere else, so the generated tokens are their only copy', () => {
    const copies = outsideProfile
      .filter(({ path }) => path.startsWith('src/'))
      .flatMap((file) =>
        hexColours(file)
          .filter((hex) => brandColours.has(hex))
          .map((hex) => `${file.path}: ${hex}`),
      );
    expect(copies).toEqual([]);
  });
});

describe('owner specifics outside the profile, in the core', () => {
  const core = repositoryFiles(['src/core']);
  const shipped = core.filter(({ path }) => !/\.test\.tsx?$/.test(path));
  const figures = recordFigures(profile.knowledge);
  const words = ownerWords(profile.identity, profile.knowledge, profile.copy.en.answers.vocabulary);

  it("derives the record's figures and the owner's words from the profile", () => {
    const metricValues = Object.values(profile.knowledge.metrics).map((metric) => metric.value);
    expect(figures).toEqual(expect.arrayContaining(metricValues));
    expect(figures).toContain(String(profile.knowledge.profile.careerStartYear));
    expect(words).toContain(profile.identity.firstName.toLowerCase());
    const ids = [
      ...profile.knowledge.experience.filter(
        (role) => !profile.identity.nonIdentifyingTerms.includes(role.company),
      ),
      ...profile.knowledge.projects,
    ].map((entry) => entry.id.toLowerCase());
    expect(words).toEqual(expect.arrayContaining(ids));
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
