import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createResponseKit } from '../../../src/core/assistant/response-kit';
import { createToolRegistry } from '../../../src/core/assistant/tools/registry';
import { localize } from '../../../src/core/knowledge/localize';
import { fixtureAnswers } from '../../../src/testing/fixture-profile';
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
import { checkEvaluation } from './evaluation';

/**
 * Each check a profile passes before anything is built from it, shown to
 * fail on one planted fault in an otherwise valid copy of the example, and to
 * say where the fault is and what to do.
 */

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
    await withoutCopy();
    await writeDocument(dir, 'copy/en/ui.yaml', 'emailSubject: Platform role\n');

    expect(await problemsOf(dir)).toEqual([
      'copy/pt-BR/: is missing: publishing pt-BR needs its copy — translate every document of copy/en/, or stop publishing pt-BR in bundle.yaml',
    ]);
  });

  it('asks for no translation of a profile that has written no copy at all', async () => {
    await withoutCopy();

    expect(await problemsOf(dir)).toEqual([]);
  });

  it('refuses a translated copy that lacks an answer of the English one', async () => {
    await writeDocument(dir, 'copy/en/answers/career.yaml', 'career: {}\ncompany: {}\n');
    await writeDocument(dir, 'copy/pt-BR/answers/career.yaml', 'career: {}\n');

    expect(await problemsOf(dir)).toEqual([
      'copy/pt-BR/answers/career.yaml#/company: "company" is missing — translate it from copy/en/answers/career.yaml',
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
    await writeDocument(
      dir,
      'evaluation/calibration.yaml',
      [
        '- answer: At Acme she cut build times by 40%.',
        '  planted: 0',
        '  actions: [{ name: getExperience, arguments: { company: acme } }]',
        '- answer: At Acme she cut build times by 90%.',
        '  planted: 1',
        '  actions: [{ name: getSalary, arguments: {} }]',
        '',
      ].join('\n'),
    );
    const { data } = await checkBundle(dir);
    const registry = createToolRegistry({
      kit: createResponseKit(localize(data.knowledge, 'en'), fixtureAnswers.labels),
      reportError: () => undefined,
    });

    expect(checkEvaluation(data, new Set(registry.tools.map(({ name }) => name)))).toEqual([
      {
        document: 'evaluation/calibration.yaml',
        at: '/1/actions/0/name',
        problem: '"getSalary" is not an action of the assistant',
        remedy: "name one of the assistant's actions",
      },
    ]);
  });
});
