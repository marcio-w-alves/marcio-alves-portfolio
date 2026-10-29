import type { ProfileData } from '../../../src/profile/schema';
import type { DecodedBundle } from '../bundle/decode';
import { ProfileProblemsError, type BundleProblem } from '../bundle/problems';
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
  const graph = words && checkSuggestionGraph(words, data.locales);
  const found = [
    ...checkTranslations(data),
    ...checkSites(data),
    ...checkRetrievalIndex(data, decoded),
    ...checkNotes(data, decoded),
    ...checkAssets(data, decoded),
    ...checkCopy(data),
    ...checkOverrides(data),
    ...(graph ?? []),
    ...checkEvaluation(data, words && assistantActionNames(words)),
  ];
  const problems = found.length > 0 || graph !== null ? found : [WORDS_UNCHECKED];
  if (problems.length > 0) throw new ProfileProblemsError(problems);
  return { data, privacy };
}

/**
 * The suggestion graph and the calibration's action names stand on compiling
 * and rendering a profile's words, so copy that does neither leaves them
 * unchecked — and some other check says why. A profile that passes everything
 * while they did not run is a defect in the checks, not a sound profile, and
 * saying so is the only way that cannot pass unnoticed.
 */
const WORDS_UNCHECKED: BundleProblem = {
  document: 'copy/',
  problem:
    'the copy could not be compiled or rendered, so the suggestion graph and the ' +
    "evaluation's action names went unchecked, and no check said why",
  remedy:
    'this is a defect in the checks, not in the profile: scripts/profile/checks/copy.ts and ' +
    'words.ts must compile the copy the same way',
};
