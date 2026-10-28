import { describe, expect, it } from 'vitest';
import type { ToolTrace } from '../../src/core/assistant/system2/model-assistant';
import { createToolRegistry } from '../../src/core/assistant/tools/registry';
import { sourcesOutsideTrace } from './citations';

/** Runs a real action, so the trace holds the sources it really returns. */
async function traced(name: string, input: object): Promise<ToolTrace> {
  return {
    name,
    arguments: JSON.stringify(input),
    outcome: await createToolRegistry().run(name, input),
  };
}

describe('sources cited outside the action trace', () => {
  it('accepts sources that the actions returned', async () => {
    const trace = [await traced('getExperience', { company: 'deel' })];
    expect(sourcesOutsideTrace(['resume.deel'], trace)).toEqual([]);
  });

  it('flags a source that no action returned', async () => {
    const trace = [await traced('getExperience', { company: 'deel' })];
    expect(sourcesOutsideTrace(['resume.deel', 'resume.roots'], trace)).toEqual(['resume.roots']);
  });

  it('flags every source when the only action failed', async () => {
    const trace = [await traced('getExperience', { company: 'google' })];
    expect(sourcesOutsideTrace(['resume.deel'], trace)).toEqual(['resume.deel']);
  });
});
