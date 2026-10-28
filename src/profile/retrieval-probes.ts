/**
 * Questions whose embeddings `pnpm rag:build` commits beside the index, so a
 * test can search the index the way a visitor does — with a question, not a
 * passage of the record — and need no key to run.
 */
export const RETRIEVAL_PROBES = {
  /** A Portuguese visitor asking where he works now: the current role must come first. */
  currentRoleInPortuguese: 'Onde ele trabalha atualmente?',
} as const;

export type RetrievalProbe = keyof typeof RETRIEVAL_PROBES;
