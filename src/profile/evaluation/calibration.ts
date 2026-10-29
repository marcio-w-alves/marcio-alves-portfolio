import type { CalibrationItem } from '../evaluation';

/**
 * The answers the evaluation's judge is checked on before it judges: a true
 * answer must pass, and every planted fabrication must be caught. Otherwise
 * its verdicts mean nothing. They are written against this record, which is
 * why they live in the profile.
 */

// The model path is judged against an action trace, not the knowledge base,
// so the judge is also checked on traces: a fact that is in the record but
// not in the trace is as unsupported as an invented one.
export const CALIBRATION: readonly CalibrationItem[] = [
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
  {
    answer:
      "At Deel he helped lead the HRIS team responsible for the company's core HR tools product.",
    planted: 0,
    actions: [{ name: 'getExperience', arguments: { company: 'deel' } }],
  },
  {
    answer: 'At Deel he managed fifteen engineers and was promoted to Staff Engineer.',
    planted: 2,
    actions: [{ name: 'getExperience', arguments: { company: 'deel' } }],
  },
  {
    answer:
      'At Roots he grew the frontend team by recruiting three developers, and at Deel he improved web vitals by 30%.',
    planted: 1,
    actions: [{ name: 'getExperience', arguments: { company: 'roots' } }],
  },
];
