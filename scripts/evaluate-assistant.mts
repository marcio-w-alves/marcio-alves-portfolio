/**
 * Holds the assistant to its own promise: every claim about the owner comes from
 * the record, anything else is declined.
 *
 * Each case runs through the production wiring. The answer, and the exact
 * evidence the assistant had — the actions the model ran and what they
 * returned, or the knowledge base itself for the fast path — go to an
 * independent judge, a stronger model, which lists every claim the evidence
 * does not support. Deterministic checks cover the rest: which path
 * answered, refusals, language, required and forbidden phrases.
 *
 * A model answer varies from run to run, so every case that can reach the
 * model runs several times and passes on two thirds of its runs.
 *
 * Costs money and needs the key, so it runs locally, not in CI:
 *   pnpm eval:assistant [--runs 3] [--only <case id or category>,…]
 * `EVAL_RUNS` sets the number of runs too.
 */
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContainer } from '../src/composition-root';
import type { AssistantEvent } from '../src/core/chat/events';
import type { ToolTrace } from '../src/core/assistant/system2/model-assistant';
import { DEFAULT_LOCALE } from '../src/core/i18n/locale';
import { createResponseKit } from '../src/core/assistant/response-kit';
import { createToolRegistry } from '../src/core/assistant/tools/registry';
import { localize } from '../src/core/knowledge/localize';
import { createOpenAIClient } from '../src/infrastructure/openai/openai-client';
import { profile } from '../src/profile';
import { CALIBRATION, type CalibrationItem } from '../src/profile/evaluation/calibration';
import type { EvaluationCase } from '../src/profile/evaluation/cases';
import { sourcesOutsideTrace } from './evaluation/citations';
import { runsFor } from './evaluation/grading';
import { parseOptions, selectCases } from './evaluation/options';
import {
  caseGrade,
  formatCaseReport,
  formatMiscalibration,
  formatSummary,
  type CaseReport,
  type RunReport,
} from './evaluation/report';

const judgeOverride = process.env.EVAL_JUDGE_MODEL;
// Same model as the assistant: a gpt-5.4 judge, run three times per case,
// drained the API credits in a day of evaluation runs (POR-74).
const JUDGE_MODEL =
  judgeOverride === undefined || judgeOverride === '' ? 'gpt-4o-mini' : judgeOverride;
const CONCURRENCY = 4;
const options = parseOptions(process.argv.slice(2), process.env);
const cases = selectCases(profile.evaluation, options.only);
const knowledge = localize(profile.knowledge, 'en');
// The fast path's evidence is the record it answers from, as the judge has always seen it:
// the product sites are retrieval's, and the fast path never reads them.
const {
  notes: _notes,
  sourceLabels: _sourceLabels,
  productSites: _productSites,
  ...knowledgeBase
} = knowledge;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY is not set. Put it in .env.local.');
// Listing and quoting every claim takes longer than the production timeout allows.
const judge = createOpenAIClient(apiKey).withOptions({ timeout: 120_000 });

interface JudgedClaim {
  readonly claim: string;
  /** Only facts are checked; a decline or an offer to help asserts nothing about the owner. */
  readonly kind: 'fact' | 'not_a_claim';
  /** Copied from the evidence; null when nothing in it supports the claim. */
  readonly quote: string | null;
}

interface Verdict {
  readonly claims: JudgedClaim[];
  readonly language: 'en' | 'pt' | 'es' | 'other';
  readonly notes: string;
}

interface RunOutcome extends RunReport {
  readonly intent: string;
  readonly answer: string;
  readonly sources: readonly string[];
  readonly verdict: Verdict;
}

const { firstName } = profile.identity;

const JUDGE_INSTRUCTIONS = `You audit an assistant on a person's portfolio website. You receive a QUESTION, the assistant's ANSWER, and the EVIDENCE — everything the assistant was given to answer with.

Today is ${new Date().toISOString().slice(0, 10)}. The EVIDENCE is ${firstName}'s own record: the roles, projects and achievements in it are his — except passages marked about: "product", which come from a product's or a company's public website. Those support claims about what the product or the company does, never a claim about what ${firstName} built, did or achieved.

Go through the ANSWER statement by statement. Split compound sentences: every fact and every characterization is its own claim, so a true fact never carries an unsupported one along with it.

Label a statement "not_a_claim" when it asserts nothing about ${firstName}: saying something is not documented, does not appear in his record, or a field is not specified, declining, explaining what the assistant can help with, offers to help, suggestions of what to ask, and remarks about the answer's own structure ("his role covered four areas", "here are three examples") that introduce what follows.

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

const RECHECK_INSTRUCTIONS = `You receive one CLAIM about ${firstName} and the EVIDENCE an assistant had. The EVIDENCE is ${firstName}'s own record: the roles, projects and achievements in it are his, so the passage describing a project supports a claim that it is his. A passage marked about: "product" is from a product's or a company's website: it supports what the product or company does, never what ${firstName} built, did or achieved. Find the passage of the EVIDENCE that supports the CLAIM and copy it character for character. A faithful paraphrase or translation is supported by the passage it restates; when the claim rests on several passages, join them with " ... ". A characterization ("brilliant", "an innovative leader", "a solid background") is supported only if the EVIDENCE makes that same characterization, not merely facts one could admire. If nothing in the EVIDENCE supports the claim, the quote is null.

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

/** What the model was given to answer with: each action it ran and what came back. */
function traceEvidence(trace: readonly ToolTrace[]) {
  return trace.map(({ name, arguments: raw, outcome }) => ({
    action: name,
    arguments: raw,
    result: outcome.ok ? outcome.result.data : { error: outcome.error },
  }));
}

async function runOnce(testCase: EvaluationCase, clientId: string): Promise<RunOutcome> {
  const trace: ToolTrace[] = [];
  const { assistant } = buildContainer({ onToolResult: (step) => trace.push(step) });
  const started = Date.now();
  const events = await Array.fromAsync(
    assistant.answer({
      question: testCase.question,
      history: testCase.history ?? [],
      context: { topic: 'overview', lastIntent: null, ctaShown: false },
      pageLocale: testCase.pageLocale ?? DEFAULT_LOCALE,
      clientId,
    }),
  );
  const ms = Date.now() - started;

  const start = events.find((event) => event.type === 'start');
  const finish = events.find((event) => event.type === 'finish');
  const intent = start?.type === 'start' ? start.intent : 'none';
  const path = intent === 'model' ? 'model' : 'fast';
  const sources = finish?.type === 'finish' ? finish.sources.map((source) => source.id) : [];
  const answer = prose(events);

  const evidence = path === 'model' ? traceEvidence(trace) : { knowledgeBase };
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
  for (const id of expect.cites ?? []) {
    if (!sources.includes(id)) failures.push(`does not cite ${id}`);
  }
  for (const claim of await unsupportedClaims(verdict, evidence))
    failures.push(`unsupported: ${claim}`);
  if (path === 'model') {
    for (const id of sourcesOutsideTrace(sources, trace))
      failures.push(`cited ${id}, which no action returned`);
  }
  if (events.some((event) => event.type === 'error')) failures.push('ended with an error event');
  if (path === 'model' && !expect.declines && closesWithOffer(answer))
    failures.push('closes with an offer of help');

  return { path, intent, answer, sources, verdict, failures, ms, trace };
}

/**
 * A closing offer of help ("let me know if…", "estou à disposição") adds
 * nothing the page does not already offer, and the prompt forbids it. Only
 * the last paragraph is checked: a decline may still say what it covers.
 */
const CLOSING_OFFER =
  /\b(let me know|feel free|happy to help|if you (?:need|have|want|would like)|à (?:sua )?disposição|se (?:precisar|quiser|tiver)|fique à vontade|estou aqui para|si (?:necesitas|quieres|tienes)|estoy a (?:tu|su) disposición|no dudes)\b/i;

export function closesWithOffer(answer: string): boolean {
  const paragraphs = answer.trim().split(/\n\s*\n/);
  return CLOSING_OFFER.test(paragraphs.at(-1) ?? '');
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

/** Runs the actions for real, so the trace is exactly what the model would have received. */
async function traceOf(actions: NonNullable<CalibrationItem['actions']>): Promise<ToolTrace[]> {
  const registry = createToolRegistry({
    kit: createResponseKit(knowledge),
    reportError: (error) => {
      console.error(error);
    },
  });
  return Promise.all(
    actions.map(async ({ name, arguments: input }) => ({
      name,
      arguments: JSON.stringify(input),
      outcome: await registry.run(name, input),
    })),
  );
}

async function calibrate({ answer, planted, actions }: CalibrationItem) {
  const trace = actions ? await traceOf(actions) : undefined;
  const evidence = trace ? traceEvidence(trace) : { knowledgeBase };
  const flagged = await unsupportedClaims(
    await judgeAnswer('Tell me about him.', answer, evidence),
    evidence,
  );
  return trace ? { answer, planted, flagged, trace } : { answer, planted, flagged };
}

const calibration = await Promise.all(CALIBRATION.map(calibrate));
const miscalibrated = calibration.filter(({ planted, flagged }) => flagged.length !== planted);
if (miscalibrated.length > 0) {
  for (const miscalibration of miscalibrated) console.error(formatMiscalibration(miscalibration));
  throw new Error('The judge failed calibration; its verdicts cannot be trusted.');
}
console.log('Judge calibrated.\n');

const jobs = cases.flatMap((testCase, caseIndex) =>
  Array.from({ length: runsFor(testCase, options.runs) }, (_, run) => ({
    testCase,
    // One id per run, so pacing never interferes with the evaluation.
    clientId: `evaluation-${String(caseIndex)}-${String(run)}`,
  })),
);
const runs = await pool(jobs, CONCURRENCY, ({ testCase, clientId }) => runOnce(testCase, clientId));

const reports: (CaseReport & { readonly runs: readonly RunOutcome[] })[] = cases.map(
  (testCase) => ({
    ...testCase,
    runs: runs.filter((_, index) => jobs[index]?.testCase === testCase),
  }),
);

console.log(`Each model-path case ran ${String(options.runs)} times.\n`);
for (const report of reports) console.log(formatCaseReport(report));
console.log(`\n${formatSummary(reports)}`);

const file = join(tmpdir(), 'assistant-evaluation.json');
await writeFile(file, JSON.stringify(reports, null, 2));
console.log(`Full report: ${file}`);
process.exitCode = reports.every((report) => caseGrade(report).passes) ? 0 : 1;
