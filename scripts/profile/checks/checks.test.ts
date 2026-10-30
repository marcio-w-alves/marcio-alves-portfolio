import { readdirSync, readFileSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { assistantActionNames } from './action-names';
import { compileWords } from './words';
import {
  checkBundle,
  editDocument,
  exampleCopy,
  problemsOf,
  reseedIndex,
  scratchDir,
  writeDocument,
  type Scratch,
} from '../testing/bundles';

/**
 * Each check a profile passes before anything is built from it, shown to
 * fail on one planted fault in an otherwise valid copy of the example, and to
 * say where the fault is and what to do.
 */

/** What a copy problem says to do where the core's own message does not say. */
const REMEDY = ' — write it as profiles/example does';

const TOOLS_DIR = fileURLToPath(new URL('../../../src/core/assistant/tools/', import.meta.url));

type CopyPart = Readonly<Record<string, unknown>>;
interface CopyAnswer {
  parts: CopyPart[];
  followUps: unknown;
  sources: unknown;
}
type CopyAnswers = Record<string, CopyAnswer | undefined>;
interface CopyTopics {
  readonly overview?: { questions: { question: string }[] };
}

let scratch: Scratch;
let dir: string;

beforeEach(async () => {
  scratch = await scratchDir();
  dir = await exampleCopy(scratch);
});
afterEach(async () => {
  await scratch.remove();
});

type Mapping = Record<string, unknown>;
interface Experience {
  experience: { engagement: string; highlights: Mapping[] }[];
}

describe('the shape of a profile', () => {
  it('lists every problem, each where it is written and what to do', async () => {
    await editDocument(dir, 'identity.yaml', (identity: { contact: Mapping }) => {
      delete identity.contact.email;
    });
    await editDocument(dir, 'knowledge/experience.yaml', (record: Experience) => {
      const [, role] = record.experience;
      if (role) role.engagement = 'volunteering';
    });

    const problems = await problemsOf(dir);

    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(
      /^identity\.yaml#\/contact\/email: .+ — write it as profiles\/example does$/,
    );
    expect(problems[1]).toMatch(
      /^knowledge\/experience\.yaml#\/experience\/1\/engagement: .+ — write it as profiles\/example does$/,
    );
  });

  it('refuses a font face the template does not bundle', async () => {
    await editDocument(dir, 'brand.yaml', (brand: { fonts: { sans: Mapping } }) => {
      brand.fonts.sans.face = 'comic-sans';
    });

    const [problem] = await problemsOf(dir);
    expect(problem).toMatch(/^brand\.yaml#\/fonts\/sans\/face: .*"inter"/);
  });
});

describe('the translations of a profile', () => {
  /**
   * The example ships copy in both languages, so a test about copy that is
   * missing or written in one language only starts from a bundle with none,
   * and writes exactly the documents it is about.
   */
  const withoutCopy = () => rm(join(dir, 'copy'), { recursive: true });

  it('refuses a Portuguese text that states a figure its English one does not', async () => {
    await editDocument(dir, 'knowledge/experience.yaml', (record: Experience) => {
      const [highlight] = record.experience[1]?.highlights ?? [];
      if (highlight) highlight['pt-BR'] = `${String(highlight['pt-BR'])} Em 40% dos times.`;
    });
    await reseedIndex(dir);

    expect(await problemsOf(dir)).toEqual([
      'knowledge/experience.yaml#/experience/1/highlights/0/pt-BR: A translation states 1 figure its English text does not — write the translation, stating exactly the figures its English text does',
    ]);
  });

  it('refuses a published language with a text left unwritten', async () => {
    await editDocument(
      dir,
      'knowledge/profile.yaml',
      (record: { profile: { summary: Mapping } }) => {
        delete record.profile.summary['pt-BR'];
      },
    );
    await reseedIndex(dir);

    expect(await problemsOf(dir)).toEqual([
      'knowledge/profile.yaml#/profile/summary/pt-BR: Publishing pt-BR needs this text in pt-BR — write the translation, stating exactly the figures its English text does',
    ]);
  });

  it('refuses a published language whose copy was never written', async () => {
    await rm(join(dir, 'copy', 'pt-BR'), { recursive: true });

    expect(await problemsOf(dir)).toEqual([
      'copy/pt-BR/: is missing: publishing pt-BR needs its copy — translate every document of copy/en/, or stop publishing pt-BR in bundle.yaml',
    ]);
  });

  it('refuses a profile that has written no copy at all, naming what it needs', async () => {
    await withoutCopy();

    const problems = await problemsOf(dir);

    expect(problems).toContain(`copy/en/: topics.yaml: the copy needs this document${REMEDY}`);
    expect(problems).toContain(`copy/en/: labels.yaml: the copy needs this document${REMEDY}`);
    expect(problems).toContain(`copy/en/: answers/: the copy needs a "greeting" answer${REMEDY}`);
  });

  it('refuses a translated copy that lacks an answer of the English one', async () => {
    await editDocument(dir, 'copy/pt-BR/answers/answers.yaml', (answers: CopyAnswers) => {
      delete answers.identity;
    });

    expect(await problemsOf(dir)).toEqual([
      'copy/pt-BR/answers/answers.yaml#/identity: "identity" is missing — translate it from copy/en/answers/answers.yaml',
      `copy/pt-BR/: answers/: no answer writes the "identity" intent, which the router still recognizes, so those questions would go to the model. Write it, or name it in facts.yaml#omit to say the omission is meant.${REMEDY}`,
      `copy/pt-BR/: answers/: the pt-BR copy has no "identity" answer, which English has${REMEDY}`,
    ]);
  });
});

describe('the sites of a profile', () => {
  it('refuses a site passage read from a page the allow-list does not name', async () => {
    await editDocument(dir, 'sites/snapshot.json', (snapshot: { entries: Mapping[] }) => {
      const [passage] = snapshot.entries;
      if (passage) passage.url = 'https://elsewhere.example/';
    });
    await reseedIndex(dir);

    expect(await problemsOf(dir)).toEqual([
      'sites/snapshot.json#/entries/0/url: "https://elsewhere.example/" is not on the site allow-list for project "pipewright" — add the page to sites/allow-list.yaml, then read the sites again (pnpm sites:ingest)',
    ]);
  });
});

describe('the retrieval index of a profile', () => {
  const rebuild = 'rebuild the index and the probes (pnpm rag:build)';

  it('refuses an index built from another version of the record', async () => {
    await editDocument(
      dir,
      'knowledge/profile.yaml',
      (record: { profile: { summary: Mapping } }) => {
        record.profile.summary.en = 'Ada builds platforms.';
        record.profile.summary['pt-BR'] = 'Ada constrói plataformas.';
      },
    );

    expect(await problemsOf(dir)).toEqual([
      `generated/knowledge-index.json: was built from another version of the record — ${rebuild}`,
    ]);
  });

  it('refuses an index without a vector for every passage, or with vectors of the wrong size', async () => {
    await editDocument(
      dir,
      'generated/knowledge-index.json',
      (index: { vectors: Record<string, number[]> }) => {
        // The first passage loses its vector; the second gets one of the wrong size.
        const [, second, ...rest] = Object.entries(index.vectors);
        const shortened: [string, number[]][] = second ? [[second[0], [0.5]]] : [];
        index.vectors = Object.fromEntries([...shortened, ...rest]);
      },
    );

    expect(await problemsOf(dir)).toEqual([
      `generated/knowledge-index.json: does not hold exactly one vector per passage of the record — ${rebuild}`,
      `generated/knowledge-index.json: has 1 vectors that are not 512 long — ${rebuild}`,
    ]);
  });

  it('refuses an index of other dimensions than the query embedding', async () => {
    await editDocument(dir, 'generated/knowledge-index.json', (index: Mapping) => {
      index.dimensions = 256;
    });

    expect(await problemsOf(dir)).toEqual([
      `generated/knowledge-index.json: has 256 dimensions, not 512 — ${rebuild}`,
    ]);
  });

  it('refuses a probe question without its embedding', async () => {
    await writeDocument(dir, 'retrieval/probes.yaml', 'currentRole: Where does she work now?\n');

    expect(await problemsOf(dir)).toEqual([
      `generated/retrieval-probes.json: does not hold exactly one vector per question of retrieval/probes.yaml — ${rebuild}`,
    ]);
  });
});

describe('the notes of a profile', () => {
  it('refuses passages generated from an earlier knowledge base', async () => {
    await writeDocument(
      dir,
      'knowledge/knowledge-base.md',
      '## 1. Platform\n\nAda moved to Buck.\n',
    );

    expect(await problemsOf(dir)).toEqual([
      'generated/notes.json: is not knowledge/knowledge-base.md as it is now — generate the passages again (pnpm notes:build)',
    ]);
  });
});

describe('the assets of a profile', () => {
  const servedAt = (path: string) =>
    editDocument(dir, 'assets.yaml', (assets: Mapping[]) => {
      const [photo] = assets;
      if (photo) photo.path = path;
    });

  it('refuses a record linking to a file no asset is served at', async () => {
    await servedAt('/portrait.jpg');

    expect(await problemsOf(dir)).toEqual([
      'knowledge/profile.yaml#/profile/photoUrl: links to a file assets.yaml does not serve — add the file to assets.yaml at that address',
    ]);
  });

  it.each(['/api/a.jpg', '/_next/a.jpg', '/a/b.jpg'])(
    'refuses %s, not a file at the root',
    async (path) => {
      await servedAt(path);

      expect(await problemsOf(dir)).toContain(
        `assets.yaml#/0/path: "${path}" is not a file at the site's root — serve it at /<name>.<extension>`,
      );
    },
  );

  it.each([
    '/robots.txt',
    '/sitemap.xml',
    '/icon',
    '/apple-icon',
    '/en.jpg',
    '/pt.pdf',
    '/skills',
    '/experience.pdf',
    '/about-this-site',
  ])("refuses %s, an address of the site's own", async (path) => {
    await servedAt(path);

    expect(await problemsOf(dir)).toContain(
      `assets.yaml#/0/path: "${path}" collides with one of the site's own addresses — give it another name`,
    );
  });

  it('refuses a file of the bundle no asset serves', async () => {
    await writeDocument(
      dir,
      'assets/spare.png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    expect(await problemsOf(dir)).toEqual([
      'assets/spare.png: is not served: assets.yaml does not name it — add it to assets.yaml, or remove it',
    ]);
  });

  it('serves a file whose name carries a dot, at the address it names', async () => {
    const photo = await readFile(join(dir, 'assets', 'ada-rivera.jpg'));
    await writeDocument(dir, 'assets/ada-rivera.v2.jpg', photo);
    await editDocument(dir, 'assets.yaml', (assets: Mapping[]) => {
      const [first] = assets;
      if (first) {
        first.file = 'assets/ada-rivera.v2.jpg';
        first.path = '/ada-rivera.v2.jpg';
      }
    });
    await editDocument(
      dir,
      'knowledge/profile.yaml',
      (record: { profile: { photoUrl: string } }) => {
        record.profile.photoUrl = '/ada-rivera.v2.jpg';
      },
    );
    await reseedIndex(dir);

    expect(await problemsOf(dir)).toEqual([
      'assets/ada-rivera.jpg: is not served: assets.yaml does not name it — add it to assets.yaml, or remove it',
    ]);
  });

  it('refuses an asset whose stated media type is not its file’s', async () => {
    await editDocument(dir, 'assets.yaml', (assets: Mapping[]) => {
      const [photo] = assets;
      if (photo) photo.mediaType = 'image/png';
    });

    expect(await problemsOf(dir)).toEqual([
      'assets.yaml#/0/mediaType: "assets/ada-rivera.jpg" is image/jpeg, not image/png — state the media type of the file',
    ]);
  });
});

describe('the evaluation of a profile', () => {
  const someCase = (id: string, cites: string[] = []) => ({
    id,
    category: 'career',
    question: 'Where does she work?',
    expect: { path: 'fast', ...(cites.length > 0 ? { cites } : {}) },
  });

  it('refuses two cases with one id', async () => {
    await editDocument(dir, 'evaluation/cases.yaml', (cases: unknown[]) => {
      cases.push(someCase('where'), someCase('where'));
    });

    expect(await problemsOf(dir)).toEqual([
      'evaluation/cases.yaml#/2/id: "where" is the id of an earlier case — give each case its own id',
    ]);
  });

  it('refuses a case expecting a source the record cannot cite', async () => {
    await editDocument(dir, 'evaluation/cases.yaml', (cases: unknown[]) => {
      cases.push(someCase('where', ['cv.acme', 'site:https://pipewright.example/', 'cv.umbrella']));
    });

    expect(await problemsOf(dir)).toEqual([
      'evaluation/cases.yaml#/1/expect/cites/2: "cv.umbrella" is not a source of the record — cite a source id of knowledge/sources.yaml, or site:<url> of a site passage',
    ]);
  });

  it("refuses a calibration answer judged against an action the assistant doesn't have", async () => {
    await writeCalibration(dir, [
      { answer: 'At Acme she cut build times by 40%.', action: 'getExperience' },
      { answer: 'At Acme she searched for build times.', action: 'searchKnowledge' },
      { answer: 'At Acme she cut build times by 90%.', action: 'getSalary' },
    ]);

    expect(await problemsOf(dir)).toEqual([
      'evaluation/calibration.yaml#/2/actions/0/name: "getSalary" is not an action of the assistant — name one of the assistant\'s actions',
    ]);
  });

  it('knows every action the assistant is wired with, however it is reached', async () => {
    const { data } = await checkBundle(dir);
    const words = compileWords(data);
    const declared = readdirSync(TOOLS_DIR)
      .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
      .flatMap((entry) => declaredNames(readFileSync(join(TOOLS_DIR, entry), 'utf8')));

    expect(declared).toContain('searchKnowledge');
    expect(declared).toContain('getGithubProfile');
    expect(words && [...assistantActionNames(words)].sort()).toEqual([...declared].sort());
  });
});

/** Every action a module defines, whether it writes its name there or in a constant. */
function declaredNames(source: string): string[] {
  const constants = new Map(
    [...source.matchAll(/^const (\w+) = '(\w+)';$/gm)].map(([, name, value]) => [name, value]),
  );
  return [...source.matchAll(/^\s+name: (?:'(\w+)'|(\w+)),$/gm)].flatMap(
    ([, literal, constant]) => {
      const name = literal ?? (constant === undefined ? undefined : constants.get(constant));
      return name === undefined ? [] : [name];
    },
  );
}

/** Calibration answers, each judged against one action, as the owner writes them. */
async function writeCalibration(
  bundle: string,
  items: readonly { answer: string; action: string }[],
) {
  await writeDocument(
    bundle,
    'evaluation/calibration.yaml',
    `${items
      .flatMap(({ answer, action }) => [
        `- answer: ${answer}`,
        '  planted: 0',
        `  actions: [{ name: ${action}, arguments: {} }]`,
      ])
      .join('\n')}\n`,
  );
}

describe('the words a profile writes', () => {
  /**
   * The same fault in every language's greeting: a fault in one alone is also
   * a difference between the two, which the translation checks report.
   */
  const plantGreeting = async (part: CopyPart) => {
    for (const locale of ['en', 'pt-BR']) {
      await editDocument(dir, `copy/${locale}/answers/answers.yaml`, (answers: CopyAnswers) => {
        const greeting = answers.greeting;
        if (greeting) greeting.parts = [part];
      });
    }
  };

  it('refuses a template naming a fact the record has not', async () => {
    await plantGreeting({ text: 'Hello from {{profile.notAField}}.' });

    expect(await problemsOf(dir)).toEqual([
      `copy/en/answers/answers.yaml#greeting.parts[0].text:1:12: Unknown path "profile.notAField": there is no "notAField"${REMEDY}`,
      `copy/pt-BR/answers/answers.yaml#greeting.parts[0].text:1:12: Unknown path "profile.notAField": there is no "notAField"${REMEDY}`,
    ]);
  });

  it('refuses a template stating one of the record’s figures literally (AC-22.1)', async () => {
    await plantGreeting({ text: '{{profile.name}} has worked here since 2012.' });

    expect(await problemsOf(dir)).toEqual([
      'copy/en/answers/answers.yaml#greeting.parts[0].text: writes the record\'s figure "2012" literally — name it with a placeholder',
      'copy/pt-BR/answers/answers.yaml#greeting.parts[0].text: writes the record\'s figure "2012" literally — name it with a placeholder',
    ]);
  });
});

describe('the interface words a profile overrides', () => {
  /** In both languages, so the translations' own parity check stays quiet. */
  const plantOverride = async (name: string, edit: (document: never) => void) => {
    for (const locale of ['en', 'pt-BR']) await editDocument(dir, `copy/${locale}/${name}`, edit);
  };

  it('refuses an override of a message the default catalog has not', async () => {
    await plantOverride('ui.yaml', (ui: Mapping) => {
      ui.emailSubjectLine = 'Platform role';
    });

    expect(await problemsOf(dir)).toEqual([
      'copy/en/ui.yaml#/emailSubjectLine: "emailSubjectLine" is not one of the default messages — word one of the default messages (src/ui/i18n/en.ts)',
      'copy/pt-BR/ui.yaml#/emailSubjectLine: "emailSubjectLine" is not one of the default messages — word one of the default messages (src/ui/i18n/pt-BR.ts)',
    ]);
  });

  it('refuses an override whose shape is not the default’s', async () => {
    await plantOverride('site.yaml', (site: Mapping) => {
      site.description = { other: 'Portfolio of {name}.' };
    });

    expect(await problemsOf(dir)).toEqual([
      'copy/en/site.yaml#/description: is a group of messages where the default is a message — word one of the default messages (src/site/site-copy.ts)',
      'copy/pt-BR/site.yaml#/description: is a group of messages where the default is a message — word one of the default messages (src/site/site-copy.ts)',
    ]);
  });

  it('refuses an override nested under a message the catalog has not', async () => {
    await plantOverride('ui.yaml', (ui: { actions: Mapping }) => {
      ui.actions.roleQuestionLabel = 'What did she do at {company}?';
    });

    expect(await problemsOf(dir)).toEqual([
      'copy/en/ui.yaml#/actions/roleQuestionLabel: "roleQuestionLabel" is not one of the default messages — word one of the default messages (src/ui/i18n/en.ts)',
      'copy/pt-BR/ui.yaml#/actions/roleQuestionLabel: "roleQuestionLabel" is not one of the default messages — word one of the default messages (src/ui/i18n/pt-BR.ts)',
    ]);
  });
});

/**
 * The owner's profile has what the example has not: a page about the site,
 * whose text names `{{identity.sourceRepository}}`. Compiling that needs the
 * identity, and a check that compiles the copy without it compiles nothing —
 * which is how the checks over a profile's words came to be inert on the only
 * real profile there is while the example passed (POR-94).
 */
describe('a profile with a page about the site', () => {
  const ABOUT = {
    label: 'About',
    title: 'About this site',
    description: 'How this site is put together.',
    markdown: 'Its code is public at {{identity.sourceRepository}}.',
  };

  beforeEach(async () => {
    await editDocument(dir, 'identity.yaml', (identity: Mapping) => {
      identity.sourceRepository = 'https://github.com/ada/portfolio';
    });
    await reseedIndex(dir);
    for (const locale of ['en', 'pt-BR']) {
      await writeDocument(dir, `copy/${locale}/about.yaml`, stringify(ABOUT));
    }
  });

  it('passes every check, so the checks over its words really ran', async () => {
    const { data } = await checkBundle(dir);

    expect(compileWords(data)).not.toBeNull();
    expect(await problemsOf(dir)).toEqual([]);
  });

  it('still refuses a calibration action the assistant does not have', async () => {
    await writeCalibration(dir, [
      { answer: 'At Acme she cut build times by 90%.', action: 'getSalary' },
    ]);

    expect(await problemsOf(dir)).toEqual([
      'evaluation/calibration.yaml#/0/actions/0/name: "getSalary" is not an action of the assistant — name one of the assistant\'s actions',
    ]);
  });

  it('still refuses a suggested question the fast path does not answer', async () => {
    await editDocument(dir, 'copy/en/answers/answers.yaml', (answers: CopyAnswers) => {
      const greeting = answers.greeting;
      if (greeting) greeting.followUps = ['Does {{first}} play chess on Tuesdays?'];
    });

    expect(await problemsOf(dir)).toEqual([
      'copy/en/: the site suggests "Does Ada play chess on Tuesdays?", which the fast path does not answer — suggest a question an answer writes, or write the answer it leads to',
    ]);
  });
});

describe('the questions a profile suggests', () => {
  it('refuses a suggested question the fast path does not answer, naming its language', async () => {
    await editDocument(dir, 'copy/pt-BR/topics.yaml', (topics: CopyTopics) => {
      const question = topics.overview?.questions[0];
      if (question) question.question = '{{first}} joga xadrez às terças?';
    });

    expect(await problemsOf(dir)).toEqual([
      'copy/pt-BR/: the site suggests "Ada joga xadrez às terças?", which the fast path does not answer — suggest a question an answer writes, or write the answer it leads to',
    ]);
  });

  it('refuses a follow-up that leads nowhere', async () => {
    await editDocument(dir, 'copy/en/answers/answers.yaml', (answers: CopyAnswers) => {
      const greeting = answers.greeting;
      if (greeting) greeting.followUps = ['Does {{first}} play chess on Tuesdays?'];
    });

    expect(await problemsOf(dir)).toEqual([
      'copy/en/: the site suggests "Does Ada play chess on Tuesdays?", which the fast path does not answer — suggest a question an answer writes, or write the answer it leads to',
    ]);
  });
});
