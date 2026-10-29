/**
 * Writes `retrieval.json`: the passages the checkout's search ranks for each
 * retrieval probe of `inputs.json`, offline. Copied into the checkout being
 * captured and run there, like enumerate.mts.
 *
 *   tsx scripts/baseline/retrieve.mts --profile owner|fixture --inputs <file> --out <file>
 */
import { parseArgs } from 'node:util';
import { isProfileName, loadCheckoutProfile } from './checkout-profile';
import type { BaselineInputs } from './inputs';
import { readJson, writePrivateJson } from './private-files';
import { retrieve } from './retrieval';

const { values } = parseArgs({
  options: {
    profile: { type: 'string', default: 'owner' },
    inputs: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!isProfileName(values.profile)) throw new Error(`Unknown profile "${values.profile}".`);
if (!values.inputs || !values.out) throw new Error('Pass --inputs <file> and --out <file>.');

const { profile, index, probes } = await loadCheckoutProfile(values.profile);
const { retrievalProbes } = await readJson<BaselineInputs>(values.inputs);
await writePrivateJson(
  values.out,
  await retrieve(profile.knowledge, index, probes, retrievalProbes),
);
console.log(`Searched ${String(retrievalProbes.length)} retrieval probes.`);
