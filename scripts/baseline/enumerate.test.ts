import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContainer } from '../../src/composition-root';
import { ROUTED_TECHNOLOGIES } from '../../src/core/assistant/system1/technologies';
import type { AssistantEvent } from '../../src/core/chat/events';
import { TOPIC_IDS } from '../../src/core/chat/topic-id';
import { buildCorpus } from '../../src/core/knowledge/corpus';
import { localize } from '../../src/core/knowledge/localize';
import { createSiteContent } from '../../src/site/site-content';
import { buildFixtureIndex } from '../../src/testing/fixture-profile/fixture-index';
import { fixtureKnowledge } from '../../src/testing/fixture-profile';
import { profile as fixtureProfile } from '../../src/testing/fixture-profile/profile';
import type { AnswerInput, BaselineInputs } from './inputs';
import { readJson } from './private-files';
import { retrieve } from './retrieval';
import { FIXTURE_ANSWERS } from './testing/site-server';
import { runTool, scratchDir, TOOL_TEST_TIMEOUT_MS } from './testing/tool';

/**
 * The enumeration, run as the capture runs it — its own process, in a
 * checkout, on the fictional profile — checked against the site itself: the
 * pages the profile defines, and the assistant the chat endpoint serves,
 * which says for every question whether the fast path answered it.
 */

let scratch: Awaited<ReturnType<typeof scratchDir>>;
let inputs: BaselineInputs;

beforeEach(async () => {
  scratch = await scratchDir();
  const out = join(scratch.path, 'inputs.json');
  const run = await runTool('enumerate.mts', ['--profile', 'fixture', '--out', out]);
  expect(run.code).toBe(0);
  inputs = await readJson<BaselineInputs>(out);
}, TOOL_TEST_TIMEOUT_MS);
afterEach(async () => {
  await scratch.remove();
});

interface Answered {
  readonly path: string;
  readonly followUps: readonly string[];
}

/**
 * Asks the assistant the endpoint serves, and reads which path answered from
 * what it reports. One question at a time: the report is read off the log.
 */
async function ask({ message, context, locale }: AnswerInput): Promise<Answered> {
  const reported: Record<string, unknown>[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    reported.push(JSON.parse(String(line)) as Record<string, unknown>);
  });
  const { assistant } = buildContainer({
    record: fixtureKnowledge,
    answers: FIXTURE_ANSWERS,
    env: { OPENAI_API_KEY: undefined, GITHUB_TOKEN: undefined },
  });
  const events: AssistantEvent[] = await Array.fromAsync(
    assistant.answer({
      question: message,
      history: [],
      context: { ...context, topic: context.topic as (typeof TOPIC_IDS)[number] },
      pageLocale: locale as 'en',
      clientId: 'enumeration-test',
    }),
  );
  log.mockRestore();
  const finish = events.find((event) => event.type === 'finish');
  return {
    path: String(reported.find(({ event }) => event === 'chat.answered')?.path),
    followUps: finish?.type === 'finish' ? finish.followUps : [],
  };
}

describe('the inputs a baseline asks', { timeout: TOOL_TEST_TIMEOUT_MS }, () => {
  it('lists every page of every published language, the metadata routes and the record files', () => {
    const { locales } = fixtureProfile;

    expect(inputs.locales).toEqual(locales);
    expect(inputs.pages.map(({ path }) => path)).toEqual([
      '/',
      ...TOPIC_IDS.slice(1).map((topic) => `/${topic}`),
      '/baseline-missing-page',
    ]);
    expect(inputs.routes.map(({ path }) => path)).toEqual([
      '/sitemap.xml',
      '/robots.txt',
      '/icon',
      '/apple-icon',
      '/brand/share-image.png',
      localize(fixtureKnowledge, 'en').profile.photoUrl,
      localize(fixtureKnowledge, 'en').contact.resumeUrl,
    ]);
  });

  it('asks only questions the fast path answers, none it escalates', async () => {
    const paths = [];
    for (const input of inputs.answers) paths.push((await ask(input)).path);

    expect(new Set(paths)).toEqual(new Set(['fast']));
    expect(new Set(inputs.answers.map(({ id }) => id)).size).toBe(inputs.answers.length);
  });

  it('asks every suggested question the fast path answers, on its page', async () => {
    const { topicCatalog } = createSiteContent(fixtureKnowledge, FIXTURE_ANSWERS.en, 'en');
    const suggested = topicCatalog.topics.flatMap(({ id, questions }) =>
      questions.map(({ question }) => ({
        id: 'suggested',
        origin: 'topic' as const,
        locale: 'en',
        message: question,
        context: { topic: id, lastIntent: null, ctaShown: false },
      })),
    );
    const answered = [];
    for (const question of suggested)
      if ((await ask(question)).path === 'fast') answered.push(question);

    const asked = inputs.answers.filter(({ origin }) => origin === 'topic');
    expect(asked.map(({ message, context }) => [context.topic, message])).toEqual(
      answered.map(({ message, context }) => [context.topic, message]),
    );
  });

  it('asks every follow-up an answer offers, on the same page', async () => {
    const asked = new Set(
      inputs.answers.map(({ locale, context, message }) => `${locale} ${context.topic} ${message}`),
    );
    const offered = [];
    for (const input of inputs.answers) {
      const { followUps } = await ask(input);
      offered.push(
        ...followUps.map((message) => `${input.locale} ${input.context.topic} ${message}`),
      );
    }

    expect(offered.length).toBeGreaterThan(0);
    expect(offered.filter((question) => !asked.has(question))).toEqual([]);
  });

  it('probes every company, project and routed technology the fast path answers by name', async () => {
    const english = localize(fixtureKnowledge, 'en');
    const names = [
      ...english.experience.flatMap(({ company, aliases = [] }) => [company, ...aliases]),
      ...english.projects.map(({ name }) => name),
      ...ROUTED_TECHNOLOGIES.map(({ name }) => name),
    ];
    const probe = (message: string): AnswerInput => ({
      id: 'probe',
      origin: 'entity',
      locale: 'en',
      message,
      context: { topic: 'overview', lastIntent: null, ctaShown: false },
    });
    const answered = [];
    for (const name of names) if ((await ask(probe(name))).path === 'fast') answered.push(name);

    const probed = inputs.answers
      .filter(({ origin }) => origin === 'entity')
      .map(({ message }) => message);
    expect(answered.length).toBeGreaterThan(0);
    expect(probed).toEqual(answered);
  });
});

describe('retrieval results', () => {
  it('ranks the passage whose vector a probe stores first, and has none for a probe without one', async () => {
    const index = buildFixtureIndex();
    const [chunk] = buildCorpus(fixtureKnowledge);
    if (!chunk) throw new Error('The fixture has no passages.');
    const probes = { vectors: { 'Where does she work?': index.vectors[chunk.id] ?? [] } };

    const results = await retrieve(fixtureKnowledge, index, probes, [
      'Where does she work?',
      'Unembedded?',
    ]);

    expect(results[0]?.results?.[0]).toMatchObject({ id: chunk.baseId, category: chunk.category });
    expect(results[0]?.results?.[0]?.score).toBeCloseTo(1, 5);
    expect(results[1]).toEqual({ probe: 'Unembedded?', results: null });
  });
});
