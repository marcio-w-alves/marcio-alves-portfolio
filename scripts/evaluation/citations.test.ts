import { describe, expect, it } from 'vitest';
import type { ToolTrace } from '../../src/core/assistant/system2/model-assistant';
import { createResponseKit } from '../../src/core/assistant/response-kit';
import { createToolRegistry } from '../../src/core/assistant/tools/registry';
import { localize } from '../../src/core/knowledge/localize';
import { fixtureKnowledge } from '../../src/testing/fixture-profile/knowledge';
import { sourcesOutsideTrace } from './citations';

const kit = createResponseKit(localize(fixtureKnowledge, 'en'));

function rethrow(error: unknown): never {
  throw error;
}

/** Runs a real action, so the trace holds the sources it really returns. */
async function traced(name: string, input: object): Promise<ToolTrace> {
  return {
    name,
    arguments: JSON.stringify(input),
    outcome: await createToolRegistry({ kit, reportError: rethrow }).run(name, input),
  };
}

describe('sources cited outside the action trace', () => {
  it('accepts sources that the actions returned', async () => {
    const trace = [await traced('getExperience', { company: 'acme' })];
    expect(sourcesOutsideTrace(['cv.acme'], trace)).toEqual([]);
  });

  it('flags a source that no action returned', async () => {
    const trace = [await traced('getExperience', { company: 'acme' })];
    expect(sourcesOutsideTrace(['cv.acme', 'cv.globex'], trace)).toEqual(['cv.globex']);
  });

  it('flags every source when the only action failed', async () => {
    const trace = [await traced('getExperience', { company: 'google' })];
    expect(sourcesOutsideTrace(['cv.acme'], trace)).toEqual(['cv.acme']);
  });
});
