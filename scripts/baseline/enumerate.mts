/**
 * Writes `inputs.json`: every page, route and fast-path question the
 * checkout's site defines (see enumeration.ts). The capture copies this file,
 * with the few it imports, into the checkout being captured and runs it there
 * with that checkout's own code — which is how a commit older than the tool
 * is captured. Never committed there.
 *
 *   tsx scripts/baseline/enumerate.mts --profile owner|fixture --out <file>
 */
import { parseArgs } from 'node:util';
import { isProfileName, loadCheckoutProfile } from './checkout-profile';
import { enumerateInputs } from './enumeration';
import { writePrivateJson } from './private-files';

const { values } = parseArgs({
  options: { profile: { type: 'string', default: 'owner' }, out: { type: 'string' } },
});
if (!isProfileName(values.profile)) throw new Error(`Unknown profile "${values.profile}".`);
if (!values.out) throw new Error('Pass --out <file> for inputs.json.');

const { profile, probes } = await loadCheckoutProfile(values.profile);
const inputs = enumerateInputs(profile, Object.keys(probes.vectors));
await writePrivateJson(values.out, inputs);
console.log(
  `Enumerated ${String(inputs.pages.length)} pages, ${String(inputs.routes.length)} routes, ` +
    `${String(inputs.answers.length)} fast-path questions and ` +
    `${String(inputs.retrievalProbes.length)} retrieval probes.`,
);
