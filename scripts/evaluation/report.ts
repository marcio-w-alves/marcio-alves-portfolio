import type { ToolTrace } from '../../src/core/assistant/system2/model-assistant';
import { grade } from './grading';

/** What one run of a case left behind, as much as the report needs. */
export interface RunReport {
  readonly path: 'fast' | 'model';
  readonly ms: number;
  readonly failures: readonly string[];
  /** The actions the model ran; empty on the fast path. */
  readonly trace: readonly ToolTrace[];
}

export interface CaseReport {
  readonly id: string;
  readonly category: string;
  readonly question: string;
  readonly runs: readonly RunReport[];
}

export interface Miscalibration {
  readonly answer: string;
  readonly planted: number;
  readonly flagged: readonly string[];
  /** The actions behind the evidence; absent when the evidence was the whole knowledge base. */
  readonly trace?: readonly ToolTrace[];
}

const ARGUMENTS_SHOWN = 120;

export function caseGrade(report: CaseReport) {
  return grade(report.runs.map(({ failures }) => failures.length === 0));
}

/** One line per action: its name, its arguments, and the source ids it handed back. */
export function describeTrace(trace: readonly ToolTrace[]): string[] {
  if (trace.length === 0) return ['(no actions ran)'];
  return trace.map(({ name, arguments: raw, outcome }) => {
    const result = outcome.ok
      ? `sources: ${outcome.result.sources.map(({ id }) => id).join(', ') || 'none'}`
      : `error: ${outcome.error}`;
    return `${name} ${summarizeArguments(raw)} → ${result}`;
  });
}

function summarizeArguments(raw: string): string {
  const compact = raw.replace(/\s+/g, ' ').trim() || '{}';
  return compact.length > ARGUMENTS_SHOWN ? `${compact.slice(0, ARGUMENTS_SHOWN)}…` : compact;
}

export function formatMiscalibration({ answer, planted, flagged, trace }: Miscalibration): string {
  const evidence = trace ? describeTrace(trace) : ['the whole knowledge base'];
  return [
    `Judge miscalibrated on "${answer}": expected ${String(planted)} flags, got ${String(flagged.length)}.`,
    ...flagged.map((claim) => `  flagged: ${claim}`),
    '  evidence:',
    ...evidence.map((line) => `    ${line}`),
  ].join('\n');
}

export function formatCaseReport(report: CaseReport): string {
  const { passed, runs, passes } = caseGrade(report);
  const paths = [...new Set(report.runs.map(({ path }) => path))].join('/');
  const ms = Math.round(report.runs.reduce((sum, run) => sum + run.ms, 0) / runs);
  const header = `${report.id.padEnd(26)} ${String(passed)}/${String(runs)}  ${passes ? 'PASS' : 'FAIL'}  ${paths.padEnd(10)} ${String(ms).padStart(6)}ms  ${report.question}`;
  return [header, ...report.runs.flatMap(describeFailedRun)].join('\n');
}

function describeFailedRun(run: RunReport, index: number): string[] {
  if (run.failures.length === 0) return [];
  const trace =
    run.path === 'model'
      ? ['      trace:', ...describeTrace(run.trace).map((line) => `        ${line}`)]
      : [];
  return [
    `    run ${String(index + 1)}:`,
    ...run.failures.map((failure) => `      - ${failure}`),
    ...trace,
  ];
}

export function formatSummary(reports: readonly CaseReport[]): string {
  const byCategory = new Map<string, { passed: number; total: number }>();
  for (const report of reports) {
    const tally = byCategory.get(report.category) ?? { passed: 0, total: 0 };
    byCategory.set(report.category, {
      passed: tally.passed + (caseGrade(report).passes ? 1 : 0),
      total: tally.total + 1,
    });
  }
  const passed = reports.filter((report) => caseGrade(report).passes).length;
  return [
    'By category:',
    ...[...byCategory].map(
      ([category, tally]) =>
        `  ${category.padEnd(18)} ${String(tally.passed)}/${String(tally.total)}`,
    ),
    '',
    `${String(passed)}/${String(reports.length)} cases passed.`,
  ].join('\n');
}
