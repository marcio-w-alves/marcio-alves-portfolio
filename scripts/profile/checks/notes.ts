import { isDeepStrictEqual } from 'node:util';
import { parseNotes } from '../../../src/core/knowledge/notes';
import type { ProfileData } from '../../../src/profile/schema';
import type { DecodedBundle } from '../bundle/decode';
import { DOCUMENTS } from '../bundle/layout';
import type { BundleProblem } from '../bundle/problems';

/** The note passages are the knowledge base as it is now, not as it was when they were generated. */
export function checkNotes(data: ProfileData, { knowledgeBase }: DecodedBundle): BundleProblem[] {
  if (isDeepStrictEqual(parseNotes(knowledgeBase), data.knowledge.notes.passages)) return [];
  return [
    {
      document: DOCUMENTS.notes,
      problem: `is not ${DOCUMENTS.knowledgeBase} as it is now`,
      remedy: 'generate the passages again (pnpm notes:build)',
    },
  ];
}
