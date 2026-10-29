import type { CopyDocuments } from '@/core/assistant/copy/copy-document';

/**
 * Copy documents that differ from a bundle's in one known way, so a test
 * plants a fault in the data a profile writes, never in the code that reads it.
 */

const PLANTED = 'answers/planted.yaml';

function answerDocuments(documents: CopyDocuments): [string, Readonly<Record<string, unknown>>][] {
  return Object.entries(documents).filter(
    (entry): entry is [string, Readonly<Record<string, unknown>>] =>
      entry[0].startsWith('answers/') && typeof entry[1] === 'object' && entry[1] !== null,
  );
}

/** The documents without one answer, wherever it was written. */
export function withoutAnswer(documents: CopyDocuments, answerId: string): CopyDocuments {
  return {
    ...documents,
    ...Object.fromEntries(
      answerDocuments(documents).map(([path, answers]) => {
        const { [answerId]: _removed, ...kept } = answers;
        return [path, kept];
      }),
    ),
  };
}

/** The documents with one answer written anew. */
export function withAnswer(
  documents: CopyDocuments,
  answerId: string,
  answer: Readonly<Record<string, unknown>>,
): CopyDocuments {
  return { ...withoutAnswer(documents, answerId), [PLANTED]: { [answerId]: answer } };
}

/** The documents with one document replaced by what `edit` makes of it. */
export function withDocument(
  documents: CopyDocuments,
  path: string,
  edit: (document: Readonly<Record<string, unknown>>) => unknown,
): CopyDocuments {
  return {
    ...documents,
    [path]: edit((documents[path] ?? {}) as Readonly<Record<string, unknown>>),
  };
}

/** A plain answer with one text part, for a test about a single template. */
export function textAnswer(template: string): Readonly<Record<string, unknown>> {
  return { parts: [{ text: template }], followUps: [], sources: [] };
}
