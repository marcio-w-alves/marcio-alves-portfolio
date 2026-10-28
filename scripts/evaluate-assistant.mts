/**
 * Holds the assistant to its own promise: every claim about Marcio comes from
 * the record, anything else is declined.
 *
 * Each case runs through the production wiring. The answer, and the exact
 * evidence the assistant had — the actions the model ran and what they
 * returned, or the knowledge base itself for the fast path — go to an
 * independent judge, a stronger model, which lists every claim the evidence
 * does not support. Deterministic checks cover the rest: which path
 * answered, refusals, language, required and forbidden phrases.
 *
 * Costs money and needs the key, so it runs locally, not in CI:
 *   pnpm eval:assistant
 */
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContainer } from '../src/composition-root';
import type { AssistantEvent } from '../src/core/assistant/assistant-event';
import type { ToolTrace } from '../src/core/assistant/system2/model-assistant';
import { knowledgeBase } from '../src/core/knowledge/knowledge-base';
import { createOpenAIClient } from '../src/infrastructure/openai/openai-client';
import { CASES, type EvaluationCase } from './evaluation/cases';

const JUDGE_MODEL = 'gpt-5.4';
const CONCURRENCY = 4;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY is not set. Put it in .env.local.');
// Listing and quoting every claim takes longer than the production timeout allows.
const judge = createOpenAIClient(apiKey).withOptions({ timeout: 120_000 });

interface JudgedClaim {
  readonly claim: string;
  /** Only facts are checked; a decline or an offer to help asserts nothing about Marcio. */
  readonly kind: 'fact' | 'not_a_claim';
  /** Copied from the evidence; null when nothing in it supports the claim. */
  readonly quote: string | null;
}

interface Verdict {
  readonly claims: JudgedClaim[];
  readonly language: 'en' | 'pt' | 'es' | 'other';
  readonly notes: string;
}

interface Outcome {
  readonly id: string;
  readonly category: string;
  readonly question: string;
  readonly path: 'fast' | 'model';
  readonly intent: string;
  readonly answer: string;
  readonly sources: readonly string[];
  readonly evidence: unknown;
  readonly verdict: Verdict;
  readonly failures: readonly string[];
  readonly ms: number;
}

const JUDGE_INSTRUCTIONS = `You audit an assistant on a person's portfolio website. You receive a QUESTION, the assistant's ANSWER, and the EVIDENCE — everything the assistant was given to answer with.

Today is ${new Date().toISOString().slice(0, 10)}. The EVIDENCE is Marcio's own record: the roles, projects and achievements in it are his.

Go through the ANSWER statement by statement. Split compound sentences: every fact and every characterization is its own claim, so a true fact never carries an unsupported one along with it.

Label a statement "not_a_claim" when it asserts nothing about Marcio: saying something is not documented, does not appear in his record, or a field is not specified, declining, explaining what the assistant can help with, offers to help, and suggestions of what to ask.

Label every other statement "fact": names, titles, dates, numbers, technologies, companies, what he did — and qualitative characterizations ("innovative", "a solid background", "a strong focus on technical excellence", "a diverse career"), which are claims too.

For each fact, copy the passage of the EVIDENCE that supports it, character for character, so it can be found by search. Quote the EVIDENCE, never the ANSWER. A faithful paraphrase or translation is supported by the passage it restates; arithmetic on the evidence (years since a start year) is supported by the passage with the numbers. When one statement rests on several passages, join them with " ... ". If nothing in the EVIDENCE supports the fact, the quote is null. A characterization is supported only if the EVIDENCE says it; general knowledge about a technology or company is supported only if the EVIDENCE says it.

Also report the language the ANSWER is written in.

Reply with JSON only: {"language": "en" | "pt" | "es" | "other", "claims": [{"claim": string, "kind": "fact" | "not_a_claim", "quote": string | null}], "notes": string}`;

/**
 * Words only: the judge often copies a quote with its JSON punctuation, and
 * that must not decide whether the passage is there.
 */
function words(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}%+]+/gu, ' ')
    .trim()} `;
}

const QUOTE_COVERAGE = 0.85;

function trigrams(text: string): string[] {
  const tokens = text.trim().split(' ');
  return tokens.length < 3
    ? [tokens.join(' ')]
    : tokens.slice(2).map((_, index) => tokens.slice(index, index + 3).join(' '));
}

/**
 * The judge often re-serializes the JSON it quotes, dropping or reordering
 * keys, so a quote counts as found when nearly all of its word trigrams are in
 * the evidence. An invented quote does not get there.
 */
function isInEvidence(fragment: string, haystack: string): boolean {
  if (haystack.includes(fragment)) return true;
  const grams = trigrams(fragment);
  const found = grams.filter((gram) => haystack.includes(` ${gram} `)).length;
  return found / grams.length >= QUOTE_COVERAGE;
}

function quoteIsInEvidence(quote: string | null, haystack: string): boolean {
  if (!quote) return false;
  const fragments = quote
    .split(/\.{3}|…/)
    .map(words)
    .filter((fragment) => fragment.trim());
  return fragments.length > 0 && fragments.every((fragment) => isInEvidence(fragment, haystack));
}

const RECHECK_INSTRUCTIONS = `You receive one CLAIM about Marcio and the EVIDENCE an assistant had. Find the passage of the EVIDENCE that supports the CLAIM and copy it character for character. A faithful paraphrase or translation is supported by the passage it restates; when the claim rests on several passages, join them with " ... ". A characterization ("brilliant", "an innovative leader", "a solid background") is supported only if the EVIDENCE makes that same characterization, not merely facts one could admire. If nothing in the EVIDENCE supports the claim, the quote is null.

Reply with JSON only: {"quote": string | null}`;

/**
 * A second look at a claim whose quote did not check out, with only the claim
 * and the evidence: with no answer in front of it, the judge cannot quote the
 * answer back as its own support.
 */
async function recheck(claim: string, evidence: unknown): Promise<string | null> {
  const completion = await judge.chat.completions.create({
    model: JUDGE_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: RECHECK_INSTRUCTIONS },
      { role: 'user', content: `CLAIM:\n${claim}\n\nEVIDENCE:\n${JSON.stringify(evidence)}` },
    ],
  });
  const { quote } = JSON.parse(completion.choices[0]?.message.content ?? '{}') as {
    quote?: string | null;
  };
  return quote ?? null;
}

/** A claim stands only if a quote of the evidence backs it and the quote is really there. */
async function unsupportedClaims(verdict: Verdict, evidence: unknown): Promise<string[]> {
  const haystack = words(JSON.stringify(evidence).replace(/\\[nrt]/g, ' '));
  const facts = verdict.claims.filter(({ kind }) => kind === 'fact');
  const unsupported: string[] = [];
  for (const { claim, quote } of facts) {
    if (quoteIsInEvidence(quote, haystack)) continue;
    const second = await recheck(claim, evidence);
    if (!quoteIsInEvidence(second, haystack)) {
      unsupported.push(second ? `${claim} (quote not in evidence: "${second}")` : claim);
    }
  }
  return unsupported;
}

async function judgeAnswer(question: string, answer: string, evidence: unknown): Promise<Verdict> {
  const completion = await judge.chat.completions.create({
    model: JUDGE_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: JUDGE_INSTRUCTIONS },
      {
        role: 'user',
        content: `QUESTION:\n${question}\n\nANSWER:\n${answer}\n\nEVIDENCE:\n${JSON.stringify(evidence)}`,
      },
    ],
  });
  return JSON.parse(completion.choices[0]?.message.content ?? '{}') as Verdict;
}

/**
 * The prose the visitor reads. Cards are left out: they are built from the
 * record mechanically and covered by unit tests, while the prose is where a
 * model — or hand-written copy — can overreach.
 */
/** Everything the visitor sees, cards included, as plain text for the phrase checks. */
function shown(events: readonly AssistantEvent[]): string {
  return events
    .map((event) => {
      if (event.type === 'text-delta') return event.delta;
      if (event.type === 'component') return `\n${JSON.stringify(event.props)}\n`;
      return '';
    })
    .join('');
}

function prose(events: readonly AssistantEvent[]): string {
  return events.map((event) => (event.type === 'text-delta' ? event.delta : '')).join('');
}

async function runCase(testCase: EvaluationCase, index: number): Promise<Outcome> {
  const traces: ToolTrace[] = [];
  const { assistant } = buildContainer({ onToolResult: (trace) => traces.push(trace) });
  const started = Date.now();
  const events = await Array.fromAsync(
    assistant.answer({
      question: testCase.question,
      history: testCase.history ?? [],
      context: { topic: 'overview', lastIntent: null, ctaShown: false },
      // One id per case, so pacing never interferes with the evaluation.
      clientId: `evaluation-${String(index)}`,
    }),
  );
  const ms = Date.now() - started;

  const start = events.find((event) => event.type === 'start');
  const finish = events.find((event) => event.type === 'finish');
  const intent = start?.type === 'start' ? start.intent : 'none';
  const path = intent === 'model' ? 'model' : 'fast';
  const sources = finish?.type === 'finish' ? finish.sources.map((source) => source.id) : [];
  const answer = prose(events);

  const evidence =
    path === 'model'
      ? traces.map((trace) => ({
          action: trace.name,
          arguments: trace.arguments,
          result: trace.outcome.ok ? trace.outcome.result.data : { error: trace.outcome.error },
        }))
      : { knowledgeBase };
  const verdict = await judgeAnswer(testCase.question, answer, evidence);

  const { expect } = testCase;
  const failures: string[] = [];
  const lower = shown(events).toLowerCase();
  if (expect.path && expect.path !== path)
    failures.push(`answered by ${path}, expected ${expect.path}`);
  if (expect.declines && sources.length > 0)
    failures.push(`should decline but cited ${sources.join(', ')}`);
  if (expect.language && verdict.language !== expect.language) {
    failures.push(`answered in ${verdict.language}, expected ${expect.language}`);
  }
  for (const fragment of expect.mentions ?? []) {
    if (!lower.includes(fragment.toLowerCase())) failures.push(`missing "${fragment}"`);
  }
  for (const fragment of expect.avoids ?? []) {
    if (lower.includes(fragment.toLowerCase())) failures.push(`contains forbidden "${fragment}"`);
  }
  for (const claim of await unsupportedClaims(verdict, evidence))
    failures.push(`unsupported: ${claim}`);
  if (events.some((event) => event.type === 'error')) failures.push('ended with an error event');

  return { ...testCase, path, intent, answer, sources, evidence, verdict, failures, ms };
}

async function pool<T, R>(
  items: readonly T[],
  size: number,
  run: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (item !== undefined) results[index] = await run(item, index);
    }
  }
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

// The judge is checked before it judges: a true answer must pass, and every
// planted fabrication must be caught. Otherwise its verdicts mean nothing.
const CALIBRATION = [
  {
    answer: 'At Deel he improved Web Vitals by 30% and cut critical page load time by 50%.',
    planted: 0,
  },
  { answer: 'Marcio worked at Google from 2012 to 2014, and he is an expert in Rust.', planted: 2 },
  {
    answer:
      'At Roots he grew the team to twelve engineers and was widely recognized as an innovative leader.',
    planted: 2,
  },
  { answer: 'Ele liderou o time de HRIS na Deel e tem uma carreira brilhante.', planted: 1 },
] as const;

const calibration = await Promise.all(
  CALIBRATION.map(async ({ answer, planted }) => {
    const evidence = { knowledgeBase };
    const flagged = await unsupportedClaims(
      await judgeAnswer('Tell me about him.', answer, evidence),
      evidence,
    );
    return { answer, planted, flagged };
  }),
);
const miscalibrated = calibration.filter(({ planted, flagged }) => flagged.length !== planted);
if (miscalibrated.length > 0) {
  for (const { answer, planted, flagged } of miscalibrated) {
    console.error(
      `Judge miscalibrated on "${answer}": expected ${String(planted)} flags, got`,
      flagged,
    );
  }
  throw new Error('The judge failed calibration; its verdicts cannot be trusted.');
}
console.log('Judge calibrated.\n');

const outcomes = await pool(CASES, CONCURRENCY, runCase);

for (const outcome of outcomes) {
  const mark = outcome.failures.length === 0 ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${outcome.id.padEnd(22)} ${outcome.path.padEnd(5)} ${String(outcome.ms).padStart(5)}ms  ${outcome.question}`,
  );
  for (const failure of outcome.failures) console.log(`        - ${failure}`);
}

const byCategory = new Map<string, { passed: number; total: number }>();
for (const outcome of outcomes) {
  const tally = byCategory.get(outcome.category) ?? { passed: 0, total: 0 };
  tally.total += 1;
  if (outcome.failures.length === 0) tally.passed += 1;
  byCategory.set(outcome.category, tally);
}
console.log('\nBy category:');
for (const [category, { passed, total }] of byCategory) {
  console.log(`  ${category.padEnd(14)} ${String(passed)}/${String(total)}`);
}
const failed = outcomes.filter((outcome) => outcome.failures.length > 0);
console.log(
  `\n${String(outcomes.length - failed.length)}/${String(outcomes.length)} cases passed.`,
);

const report = join(tmpdir(), 'assistant-evaluation.json');
await writeFile(report, JSON.stringify(outcomes, null, 2));
console.log(`Full report: ${report}`);
process.exitCode = failed.length > 0 ? 1 : 0;
