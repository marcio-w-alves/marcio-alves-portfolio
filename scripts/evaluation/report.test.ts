import { describe, expect, it } from 'vitest';
import type { ToolTrace } from '../../src/core/assistant/system2/model-assistant';
import { createToolRegistry } from '../../src/core/assistant/tools/registry';
import {
  describeTrace,
  formatCaseReport,
  formatMiscalibration,
  formatSummary,
  type CaseReport,
  type RunReport,
} from './report';

/** Runs a real action, so the trace holds what the model would have received. */
async function traced(name: string, input: object): Promise<ToolTrace> {
  return {
    name,
    arguments: JSON.stringify(input),
    outcome: await createToolRegistry().run(name, input),
  };
}

const passing: RunReport = { path: 'model', ms: 100, failures: [], trace: [] };

function failing(trace: readonly ToolTrace[]): RunReport {
  return { path: 'model', ms: 200, failures: ['unsupported: he led fifteen engineers'], trace };
}

function caseReport(id: string, category: string, runs: readonly RunReport[]): CaseReport {
  return { id, category, question: 'Has he led teams?', runs };
}

describe('the evaluation report', () => {
  it('reports each case with its pass rate and verdict', () => {
    const lines = formatCaseReport(
      caseReport('leadership', 'leadership', [passing, failing([]), passing]),
    ).split('\n');
    expect(lines[0]).toMatch(/^leadership\s+2\/3 {2}PASS\b/);
  });

  it('fails a case that passed one run of three', () => {
    const header = formatCaseReport(
      caseReport('leadership', 'leadership', [failing([]), failing([]), passing]),
    ).split('\n')[0];
    expect(header).toMatch(/^leadership\s+1\/3 {2}FAIL\b/);
  });

  it('totals the passing cases, overall and by category', () => {
    const summary = formatSummary([
      caseReport('leadership', 'leadership', [passing, passing, failing([])]),
      caseReport('leadership-pt', 'leadership', [failing([]), failing([]), passing]),
      caseReport('poem', 'off-topic', [passing]),
    ]);
    expect(summary).toMatch(/leadership\s+1\/2/);
    expect(summary).toMatch(/off-topic\s+1\/1/);
    expect(summary).toContain('2/3 cases passed.');
  });

  it('shows the actions behind a failing model run', async () => {
    const trace = [await traced('getExperience', { company: 'deel' })];
    const report = formatCaseReport(caseReport('leadership', 'leadership', [failing(trace)]));
    expect(report).toContain('unsupported: he led fifteen engineers');
    expect(report).toContain('getExperience {"company":"deel"} → sources: resume.deel');
  });

  it('shows the tool trace when a claim fails calibration', async () => {
    const trace = [
      await traced('getExperience', { company: 'roots' }),
      await traced('getExperience', { company: 'google' }),
    ];
    const output = formatMiscalibration({
      answer: 'At Deel he improved web vitals by 30%.',
      planted: 1,
      flagged: [],
      trace,
    });
    expect(output).toContain('expected 1 flags, got 0');
    expect(output).toContain('getExperience {"company":"roots"} → sources: resume.roots');
    expect(output).toMatch(/getExperience \{"company":"google"\} → error: /);
  });

  it('names the knowledge base as the evidence when there was no trace', () => {
    const output = formatMiscalibration({
      answer: 'Marcio worked at Google.',
      planted: 1,
      flagged: [],
    });
    expect(output).toContain('the whole knowledge base');
  });

  it('says so when the model ran no actions', () => {
    expect(describeTrace([])).toEqual(['(no actions ran)']);
  });
});
