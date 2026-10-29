import type { ProfileData } from '../../../src/profile/schema';
import type { DecodedBundle } from '../bundle/decode';
import { ProfileProblemsError } from '../bundle/problems';
import { assistantActionNames } from './action-names';
import { checkAssets } from './assets';
import { checkCopy } from './copy';
import { checkEvaluation } from './evaluation';
import { checkNotes } from './notes';
import { checkOverrides } from './overrides';
import { checkRetrievalIndex } from './retrieval-index';
import { checkSchema, type PrivacyTerms } from './schema';
import { checkSites } from './sites';
import { checkSuggestionGraph } from './suggestion-graph';
import { checkTranslations } from './translations';
import { compileWords } from './words';

export interface CheckedProfile {
  readonly data: ProfileData;
  readonly privacy: PrivacyTerms;
}

/**
 * Runs every check a profile must pass before anything is built from it or it
 * is stored, and throws with all their problems. The shape comes first: the
 * other checks read the profile's parts, so they run only on a sound shape.
 */
export function checkProfile(decoded: DecodedBundle): CheckedProfile {
  const shape = checkSchema(decoded);
  if (!shape.ok) throw new ProfileProblemsError(shape.problems);
  const { data, privacy } = shape;
  // Compiled once: the copy check proves the words itself, and the questions
  // they suggest and the actions the calibration may name are read off these.
  const words = compileWords(data);
  const problems = [
    ...checkTranslations(data),
    ...checkSites(data),
    ...checkRetrievalIndex(data, decoded),
    ...checkNotes(data, decoded),
    ...checkAssets(data, decoded),
    ...checkCopy(data),
    ...checkOverrides(data),
    ...(words ? checkSuggestionGraph(words, data.locales) : []),
    ...checkEvaluation(data, words && assistantActionNames(words)),
  ];
  if (problems.length > 0) throw new ProfileProblemsError(problems);
  return { data, privacy };
}
