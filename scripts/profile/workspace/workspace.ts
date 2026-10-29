import type { MediaType } from '../bundle/layout';

/**
 * Where a profile is read from and written to — a bundle directory or the
 * profile database — as the commands see it. The commands own this port; each
 * store implements it.
 */

export interface Document {
  readonly mediaType: MediaType;
  readonly bytes: Uint8Array;
}

/** One whole profile: every document, by its bundle path. */
export interface ProfileDocuments {
  /** The bundle format version, from `bundle.yaml`. */
  readonly format: number;
  readonly documents: ReadonlyMap<string, Document>;
}

export interface WorkspaceRevision {
  /** `dir` for a bundle directory; the revision number in the database. */
  readonly id: string;
  /** The digest of the whole profile (see `digest.ts`): equal digests, identical profiles. */
  readonly digest: string;
}

export type RevisionOrigin = 'import' | 'rag-build' | 'notes-build' | 'sites-ingest' | 'restore';

export interface RevisionChange {
  readonly put: ReadonlyMap<string, Document>;
  readonly remove: readonly string[];
  readonly origin: RevisionOrigin;
  readonly note?: string;
}

export interface ProfileWorkspace {
  read(): Promise<{ revision: WorkspaceRevision; profile: ProfileDocuments }>;
  /** Writes a whole new revision; `expected` is the revision the change was computed from. */
  write(change: RevisionChange, expected: WorkspaceRevision): Promise<WorkspaceRevision>;
}
