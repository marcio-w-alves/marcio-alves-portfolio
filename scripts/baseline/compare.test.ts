import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCORED_INTENTS } from '../../src/core/assistant/system1/intents';
import { fixtureAnswers, fixturePortugueseAnswers } from '../../src/testing/fixture-profile';
import { profile as fixtureProfile } from '../../src/testing/fixture-profile/profile';
import type { CapturedAnswer } from './answers';
import { captureFiles } from './capture-layout';
import { compareCaptures } from './compare-captures';
import { enumerateInputs } from './enumeration';
import type { AnswerInput, BaselineInputs, RouteInput } from './inputs';
import { BASELINE_TOOL_VERSION, readManifest } from './manifest';
import { readJson } from './private-files';
import { withEditedAnswer } from './testing/planted-edit';
import { startSiteServer, type SiteServer, type StaticRoute } from './testing/site-server';
import {
  captureOf,
  REPOSITORY,
  runTool,
  scratchDir,
  TOOL_TEST_TIMEOUT_MS,
  writeInputs,
} from './testing/tool';

/**
 * Captures taken from a real HTTP server in front of the site's own chat
 * handler, wired to the fictional profile, then compared — through the
 * command the owner runs where the exit code is the point.
 */

const ENUMERATED = enumerateInputs(fixtureProfile, []);
const ANSWERS = ENUMERATED.answers.filter(({ origin }) => origin === 'topic').slice(0, 6);
const ONLY_ANSWERS: BaselineInputs = { ...ENUMERATED, pages: [], routes: [], answers: ANSWERS };

let scratch: Awaited<ReturnType<typeof scratchDir>>;
const servers: SiteServer[] = [];

async function serve(...options: Parameters<typeof startSiteServer>): Promise<URL> {
  const server = await startSiteServer(...options);
  servers.push(server);
  return server.url;
}

async function captureAt(target: URL, inputs: BaselineInputs, name: string): Promise<string> {
  const dir = join(scratch.path, name);
  await mkdir(dir);
  return captureOf(target, await writeInputs(dir, inputs), join(dir, 'capture'));
}

beforeEach(async () => {
  // The site logs every answer as a structured line, and the capture its progress.
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  scratch = await scratchDir();
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await scratch.remove();
});

async function aScoredAnswer(dir: string): Promise<CapturedAnswer> {
  const folder = captureFiles(dir).answers;
  const captured = await Promise.all(
    (await readdir(folder)).map((name) => readJson<CapturedAnswer>(join(folder, name))),
  );
  // The edit is keyed by the question, so it must be asked only once.
  const askedOnce = (message: string) =>
    ANSWERS.filter((input) => input.message === message).length === 1;
  const scored = captured.find(
    ({ asked, observed }) =>
      askedOnce(asked.message) &&
      (SCORED_INTENTS as readonly string[]).includes(observed.intent ?? ''),
  );
  if (!scored) throw new Error('No sample question is asked once and answered by an intent.');
  return scored;
}

describe('comparing a build with the baseline', { timeout: TOOL_TEST_TIMEOUT_MS }, () => {
  it('reports exactly the one answer that differs, and nothing for identical builds', async () => {
    const site = await serve();
    const baseline = await captureAt(site, ONLY_ANSWERS, 'baseline');
    const sameBuild = await captureAt(site, ONLY_ANSWERS, 'same-build');
    const { asked } = await aScoredAnswer(baseline);
    const edited = await serve({
      answers: {
        en: withEditedAnswer(fixtureAnswers, asked.message, 'planted'),
        'pt-BR': withEditedAnswer(fixturePortugueseAnswers, asked.message, 'planted'),
      },
    });
    const plantedBuild = await captureAt(edited, ONLY_ANSWERS, 'planted-build');

    const identical = await runTool('compare.mts', [
      '--baseline',
      baseline,
      '--capture',
      sameBuild,
    ]);
    const planted = await runTool('compare.mts', [
      '--baseline',
      baseline,
      '--capture',
      plantedBuild,
    ]);

    expect(identical.code).toBe(0);
    expect(identical.stdout).toContain('0 difference(s)');
    expect(planted.code).toBe(1);
    const reported = planted.stdout.split('\n').filter((line) => line.startsWith('changed'));
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatch(
      new RegExp(`^changed +answer:${escape(asked.id)}#parts\\[\\d+\\]\\.text  .* planted"$`),
    );
  });

  it('treats a missing or an extra input as a difference', async () => {
    const site = await serve();
    const [kept, dropped, added] = [ANSWERS.slice(0, 4), ANSWERS[4], ANSWERS[5]] as [
      AnswerInput[],
      AnswerInput,
      AnswerInput,
    ];
    const baseline = await captureAt(
      site,
      { ...ONLY_ANSWERS, answers: [...kept, dropped] },
      'baseline',
    );
    const target = await captureAt(site, { ...ONLY_ANSWERS, answers: [...kept, added] }, 'target');

    const { differences } = await compareCaptures(baseline, target);

    expect(differences).toEqual([
      { location: `answer:${dropped.id}`, kind: 'missing', detail: 'in the baseline only' },
      { location: `answer:${added.id}`, kind: 'unexpected', detail: 'in the target only' },
    ]);
  });
});

describe('comparing files and metadata routes', { timeout: TOOL_TEST_TIMEOUT_MS }, () => {
  const RESUME: RouteInput = {
    id: '/ada-rivera-cv.pdf',
    path: '/ada-rivera-cv.pdf',
    kind: 'asset',
  };
  const ROUTES_ONLY: BaselineInputs = { ...ONLY_ANSWERS, answers: [], routes: [RESUME] };
  const PDF = new TextEncoder().encode('%PDF-1.7 Ada Rivera, platform engineer');
  const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

  async function captureServing(file: StaticRoute, name: string) {
    const site = await serve({ files: { [RESUME.path]: file } });
    return captureAt(site, ROUTES_ONLY, name);
  }

  it('finds no difference when the bytes and the type are the same', async () => {
    const baseline = await captureServing({ body: PDF, contentType: 'application/pdf' }, 'a');
    const target = await captureServing({ body: PDF, contentType: 'application/pdf' }, 'b');

    await expect(compareCaptures(baseline, target)).resolves.toMatchObject({ differences: [] });
  });

  it('reports a flipped byte with both SHA-256s', async () => {
    const flipped = PDF.map((byte, index) => (index === 10 ? byte ^ 1 : byte));
    const baseline = await captureServing({ body: PDF, contentType: 'application/pdf' }, 'a');
    const target = await captureServing({ body: flipped, contentType: 'application/pdf' }, 'b');

    const { differences } = await compareCaptures(baseline, target);

    expect(differences).toEqual([
      {
        location: `route:${RESUME.id}#bytes`,
        kind: 'changed',
        detail: `sha256 ${sha256(PDF)} → ${sha256(flipped)}`,
      },
    ]);
  });

  it('reports a changed content type', async () => {
    const baseline = await captureServing({ body: PDF, contentType: 'application/pdf' }, 'a');
    const target = await captureServing(
      { body: PDF, contentType: 'application/octet-stream' },
      'b',
    );

    const { differences } = await compareCaptures(baseline, target);

    expect(differences).toEqual([
      {
        location: `route:${RESUME.id}#content-type`,
        kind: 'changed',
        detail: 'application/pdf → application/octet-stream',
      },
    ]);
  });
});

describe('provenance', { timeout: TOOL_TEST_TIMEOUT_MS }, () => {
  it('stores the commit, the date and the tool version, and refuses a baseline without them', async () => {
    const site = await serve();
    const before = Date.now();
    const baseline = await captureAt(site, ONLY_ANSWERS, 'baseline');
    const unfinished = join(scratch.path, 'unfinished');
    await mkdir(join(unfinished, 'answers'), { recursive: true });

    const manifest = await readManifest(baseline);
    const refused = await runTool('compare.mts', ['--baseline', unfinished, '--capture', baseline]);

    const head = execFileSync('git', ['-C', REPOSITORY, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    expect(manifest.commit).toBe(head.trim());
    expect(Date.parse(manifest.date)).toBeGreaterThanOrEqual(before - 1000);
    expect(manifest.tool).toEqual({ version: BASELINE_TOOL_VERSION, commit: head.trim() });
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(`${unfinished} has no manifest.json`);
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
