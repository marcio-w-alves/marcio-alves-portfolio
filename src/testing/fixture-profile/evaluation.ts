import type { CalibrationItem, EvaluationCase } from '@/profile/evaluation';

/**
 * What the fictional person's evaluation holds: enough of each kind that the
 * checks over cases, their citations and the judge's calibration have
 * something real to run on, and nothing that names anyone real.
 */

export const fixtureEvaluation: readonly EvaluationCase[] = [
  {
    id: 'acme-build-times',
    category: 'career',
    question: 'How did she speed up builds at Acme?',
    expect: { path: 'fast', mentions: ['remote caching'], cites: ['cv.acme'] },
  },
];

export const fixtureCalibration: readonly CalibrationItem[] = [
  { answer: 'At Acme she cut build times with remote caching.', planted: 0 },
  {
    answer: 'At Acme she cut build times by 90% and led a team of fifty.',
    planted: 2,
    actions: [{ name: 'getExperience', arguments: { company: 'acme' } }],
  },
];
