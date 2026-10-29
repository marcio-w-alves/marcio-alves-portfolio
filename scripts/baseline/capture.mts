/**
 * Captures a baseline of a running site (design §6): pages, metadata routes,
 * files, fast-path answers, and — with --checkout — retrieval results and,
 * with --eval, one gpt-4o-mini evaluation run. Written outside the repository,
 * to PROFILE_HOME/baseline/<commit>/ unless --out says otherwise; never inside
 * a work tree of it. Resumes where an interrupted run stopped.
 *
 *   pnpm baseline:capture --target <url> [--checkout <dir>] [--out <dir>]
 *     [--inputs <inputs.json>] [--profile owner|fixture] [--eval]
 *
 * Start a local target without the model and with room for every question:
 *   OPENAI_API_KEY= CHAT_REQUESTS_PER_TEN_MINUTES=100000 pnpm start --port 3200
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { capture } from './capture-site';
import { isProfileName } from './checkout-profile';
import { systemClock } from './pacing';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    checkout: { type: 'string' },
    out: { type: 'string' },
    inputs: { type: 'string' },
    profile: { type: 'string', default: 'owner' },
    eval: { type: 'boolean', default: false },
  },
});

try {
  if (!values.target) throw new Error('Pass --target <url> of the running site.');
  if (!isProfileName(values.profile)) throw new Error(`Unknown profile "${values.profile}".`);
  const dir = await capture({
    target: new URL(values.target),
    out: values.out && resolve(values.out),
    checkout: values.checkout && resolve(values.checkout),
    inputsFile: values.inputs && resolve(values.inputs),
    profile: values.profile,
    evaluation: values.eval,
    env: process.env,
    clock: systemClock,
  });
  console.log(`Baseline captured in ${dir}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
