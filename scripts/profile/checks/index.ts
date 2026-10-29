import type { ProfileData } from '../../../src/profile/schema';
import type { DecodedBundle } from '../bundle/decode';
import { ProfileProblemsError } from '../bundle/problems';
import { checkAssets } from './assets';
import { checkEvaluation } from './evaluation';
import { checkNotes } from './notes';
import { checkRetrievalIndex } from './retrieval-index';
import { checkSchema, type PrivacyTerms } from './schema';
import { checkSites } from './sites';
import { checkTranslations } from './translations';

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
  const problems = [
    ...checkTranslations(data),
    ...checkSites(data),
    ...checkRetrievalIndex(data, decoded),
    ...checkNotes(data, decoded),
    ...checkAssets(data, decoded),
    ...checkEvaluation(data),
  ];
  if (problems.length > 0) throw new ProfileProblemsError(problems);
  return { data, privacy };
}
