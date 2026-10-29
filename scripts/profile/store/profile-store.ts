import { createHash } from 'node:crypto';
import { ReportedError } from '../reported-error';
import { bundleFormatOf } from '../bundle/decode';
import { digestOf } from '../bundle/digest';
import type { MediaType } from '../bundle/layout';
import type {
  Document,
  ProfileDocuments,
  ProfileWorkspace,
  RevisionChange,
  WorkspaceRevision,
} from '../workspace/workspace';
import { readWithRetries, withSession, type Session, type SessionOptions } from './connect';
import type { Clock } from './retry';

/**
 * The profile database as the commands see it: a workspace whose revisions are
 * immutable and content-addressed. A read is one snapshot, re-hashed before it
 * is trusted; a write is one serializable transaction that ends by moving the
 * head, so an interrupted write leaves the profile exactly as it was.
 */

/** The revision a change is computed from when the store holds no profile yet. */
export const NO_REVISION: WorkspaceRevision = { id: 'none', digest: digestOf(new Map()) };

/** How many revisions are kept besides the head's (Steady State: the history is bounded). */
export const REVISIONS_KEPT = 20;

export class EmptyStoreError extends ReportedError {
  constructor() {
    super('The database holds no profile yet — import a bundle.');
  }
}

export class CorruptStoreError extends ReportedError {
  constructor(detail: string) {
    super(
      `The stored profile is corrupt: ${detail}. Nothing was built from it. The way back is to ` +
        'import a bundle you hold — `pnpm profile import <dir>` replaces the bytes that rotted, ' +
        'including a blob several revisions share, and your newest backup is under ' +
        'PROFILE_HOME/backups. `pnpm profile restore <id>` helps only when another revision ' +
        'does not hold the same damaged bytes; `pnpm profile revisions` lists them. Both back ' +
        'the damaged profile up first, as `-unverified`.',
    );
  }
}

/** Someone wrote a revision between the read this change was computed from and this write. */
export class ProfileChangedError extends ReportedError {
  constructor() {
    super('The profile changed since your backup; run the import again.');
  }
}

export class RevisionNotFoundError extends ReportedError {
  constructor(id: string) {
    super(`Revision ${id} not found; \`pnpm profile revisions\` lists the ones that are kept.`);
  }
}

export interface StoredRevision {
  readonly id: string;
  readonly digest: string;
  readonly origin: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly isHead: boolean;
}

/** One revision's documents, with the revision they came from. */
export interface StoredProfile {
  readonly revision: WorkspaceRevision;
  readonly profile: ProfileDocuments;
  /**
   * The documents whose stored bytes do not hash to the key they are filed
   * under — empty for anything read through `read` or `readRevision`, which
   * refuse a revision that does not verify.
   */
  readonly damaged: readonly string[];
}

export interface ProfileStore extends ProfileWorkspace {
  revisions(): Promise<StoredRevision[]>;
  /** The documents of one revision, not only the one at head. */
  readRevision(id: string): Promise<StoredProfile>;
  /**
   * The documents as the database has them, without checking that they are
   * what the revision claims, and saying which of them are not. Only the two
   * commands that replace a profile read this way, and only so that a damaged
   * revision can be backed up and written over: a build never ships what it
   * cannot verify.
   */
  readUnverified(revision?: string): Promise<StoredProfile>;
  /** Drops every revision but the newest few and the head's, and the blobs left over. */
  prune(): Promise<void>;
}

export interface StoreOptions {
  readonly url: string;
  readonly variable: string;
  /** The command the sessions are named after, e.g. `import`. */
  readonly command: string;
  readonly clock?: Clock;
}

interface HeadRow {
  readonly id: string;
  readonly digest: Buffer;
  readonly bundle_format: number;
}

interface DocumentRow {
  readonly path: string;
  readonly media_type: string;
  readonly blob_sha256: Buffer;
  readonly bytes: Buffer;
}

const HEAD = `select r.id::text as id, r.digest, r.bundle_format
                 from profile.head h join profile.revision r on r.id = h.revision_id`;

const REVISION = `select r.id::text as id, r.digest, r.bundle_format
                    from profile.revision r where r.id = $1::bigint`;

const DOCUMENTS = `select d.path, d.media_type, d.blob_sha256, b.bytes
                     from profile.document d join profile.blob b on b.sha256 = d.blob_sha256
                    where d.revision_id = $1::bigint order by d.path`;

export function profileStore({ url, variable, command, clock }: StoreOptions): ProfileStore {
  const session: SessionOptions = {
    url,
    variable,
    applicationName: `profile-${command}`,
  };
  const retrying = { ...session, ...(clock === undefined ? {} : { clock }) };

  async function readRevisionWith(
    operation: string,
    select: string,
    values: readonly unknown[],
    missing: () => Error,
    verify = true,
  ): Promise<StoredProfile> {
    return readWithRetries<StoredProfile>(retrying, operation, async (open) =>
      open.transaction('repeatable read read only', async () => {
        const [head] = await open.query<HeadRow>(select, values);
        if (!head) throw missing();
        const documents = await open.query<DocumentRow>(DOCUMENTS, [head.id]);
        return snapshotOf(head, documents, verify);
      }),
    );
  }

  const read = () => readRevisionWith('Reading the profile', HEAD, [], () => new EmptyStoreError());

  const readUnverified = (id?: string) =>
    id === undefined
      ? readRevisionWith(
          'Reading the profile as it is stored',
          HEAD,
          [],
          () => new EmptyStoreError(),
          false,
        )
      : readRevisionWith(
          `Reading revision ${id} as it is stored`,
          REVISION,
          [revisionId(id)],
          () => new RevisionNotFoundError(id),
          false,
        );

  const readRevision = (id: string) =>
    readRevisionWith(
      `Reading revision ${id}`,
      REVISION,
      [revisionId(id)],
      () => new RevisionNotFoundError(id),
    );

  async function write(change: RevisionChange, expected: WorkspaceRevision) {
    return withSession({ ...session }, 'Writing a revision', async (open) =>
      open.transaction('serializable', () => writeRevision(open, change, expected)),
    ).catch(asProfileChanged);
  }

  async function revisions(): Promise<StoredRevision[]> {
    return readWithRetries<StoredRevision[]>(retrying, 'Listing the revisions', async (open) =>
      (
        await open.query<StoredRevision & { digest: Buffer }>(
          `select r.id::text as id, r.digest, r.origin, r.note,
                  r.created_at::text as "createdAt", r.created_by as "createdBy",
                  (h.revision_id is not null) as "isHead"
             from profile.revision r
             left join profile.head h on h.revision_id = r.id
            order by r.id desc`,
        )
      ).map((row) => ({ ...row, digest: row.digest.toString('hex') })),
    );
  }

  async function prune() {
    await withSession(session, 'Pruning old revisions', async (open) => {
      await open.transaction('read committed', async () => {
        await open.query(
          `delete from profile.revision r
             where r.id not in (select id from profile.revision order by id desc limit $1::int)
               and r.id <> (select revision_id from profile.head)`,
          [REVISIONS_KEPT],
        );
        await open.query(
          `delete from profile.blob b
             where not exists (select 1 from profile.document d where d.blob_sha256 = b.sha256)`,
        );
      });
    });
  }

  return { read, readUnverified, write, readRevision, revisions, prune };
}

function revisionId(id: string): string {
  if (!/^[0-9]+$/.test(id)) throw new RevisionNotFoundError(id);
  return id;
}

/** A write lost its race; every way that shows up means the same thing to the owner. */
function asProfileChanged(error: unknown): never {
  const codes = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected
  for (let step: unknown = error; step instanceof Error; step = step.cause) {
    if (codes.has((step as { code?: string }).code ?? '')) throw new ProfileChangedError();
  }
  throw error;
}

/**
 * The documents of a revision, after checking that the bytes are the bytes
 * their keys say they are and that together they are the profile the revision
 * claims. A build fails on a corrupt profile instead of shipping it; only
 * `readUnverified` asks for the documents without that check, and says which
 * of them did not hold up.
 */
function snapshotOf(head: HeadRow, rows: readonly DocumentRow[], verify: boolean): StoredProfile {
  const documents = new Map<string, Document>();
  const damaged: string[] = [];
  for (const { path, media_type: mediaType, blob_sha256: stored, bytes } of rows) {
    const found = createHash('sha256').update(bytes).digest();
    if (!found.equals(stored)) {
      if (verify) throw new CorruptStoreError(`the bytes of ${path} are not its blob`);
      damaged.push(path);
    }
    documents.set(path, { mediaType: mediaType as MediaType, bytes: new Uint8Array(bytes) });
  }
  const digest = head.digest.toString('hex');
  if (verify && digestOf(documents) !== digest) {
    throw new CorruptStoreError(`revision ${head.id} does not hold the documents of its digest`);
  }
  return {
    revision: { id: head.id, digest },
    profile: { format: head.bundle_format, documents },
    damaged,
  };
}

async function writeRevision(
  open: Session,
  change: RevisionChange,
  expected: WorkspaceRevision,
): Promise<WorkspaceRevision> {
  const [head] = await open.query<HeadRow>(HEAD, []);
  if ((head?.id ?? NO_REVISION.id) !== expected.id) throw new ProfileChangedError();
  const base = head
    ? await open.query<DocumentRow>(DOCUMENTS, [head.id])
    : ([] as readonly DocumentRow[]);
  const documents = applyChange(base, change);
  const digest = digestOf(documents);
  await insertBlobs(open, documents);
  const [created] = await open.query<{ id: string }>(
    `insert into profile.revision (digest, bundle_format, origin, note)
     values ($1, $2::int, $3, $4) returning id::text as id`,
    [Buffer.from(digest, 'hex'), bundleFormatOf(documents), change.origin, change.note ?? null],
  );
  if (!created) throw new Error('The database accepted no revision.');
  await insertDocuments(open, created.id, documents);
  await moveHead(open, created.id, head?.id);
  return { id: created.id, digest };
}

function applyChange(
  base: readonly DocumentRow[],
  { put, remove }: RevisionChange,
): Map<string, Document> {
  const documents = new Map<string, Document>(
    base.map(({ path, media_type: mediaType, bytes }) => [
      path,
      { mediaType: mediaType as MediaType, bytes: new Uint8Array(bytes) },
    ]),
  );
  for (const path of remove) documents.delete(path);
  for (const [path, document] of put) documents.set(path, document);
  return documents;
}

/**
 * The blobs of a revision, inserted once and shared by every revision that
 * holds the same bytes.
 *
 * The write heals: a blob already there under the same key keeps its row, but
 * if its bytes have rotted they are replaced by these. Every key is the
 * SHA-256 of the bytes filed under it, computed here, so the only thing this
 * can overwrite is bytes that were not what their key says — which is why
 * importing a bundle you hold is the way back from a damaged blob, including
 * one that several revisions share.
 */
async function insertBlobs(open: Session, documents: ReadonlyMap<string, Document>): Promise<void> {
  const blobs = new Map<string, Buffer>();
  for (const { bytes } of documents.values()) {
    const buffer = Buffer.from(bytes);
    blobs.set(createHash('sha256').update(buffer).digest('hex'), buffer);
  }
  await open.query(
    `insert into profile.blob (sha256, bytes)
     select * from unnest($1::bytea[], $2::bytea[])
         on conflict (sha256) do update set bytes = excluded.bytes
          where profile.blob.bytes <> excluded.bytes`,
    [[...blobs.keys()].map((sha) => Buffer.from(sha, 'hex')), [...blobs.values()]],
  );
}

async function insertDocuments(
  open: Session,
  revision: string,
  documents: ReadonlyMap<string, Document>,
): Promise<void> {
  const entries = [...documents];
  await open.query(
    `insert into profile.document (revision_id, path, media_type, blob_sha256)
     select $1::bigint, * from unnest($2::text[], $3::text[], $4::bytea[])`,
    [
      revision,
      entries.map(([path]) => path),
      entries.map(([, { mediaType }]) => mediaType),
      entries.map(([, { bytes }]) => createHash('sha256').update(bytes).digest()),
    ],
  );
}

/**
 * The last statement of the transaction: the profile changes when, and only
 * when, the head moves to the new revision — and only if nobody else moved it.
 */
async function moveHead(
  open: Session,
  revision: string,
  previous: string | undefined,
): Promise<void> {
  const swapped =
    previous === undefined
      ? await open.query(
          `insert into profile.head (revision_id) values ($1::bigint)
             on conflict (singleton) do nothing returning singleton`,
          [revision],
        )
      : await open.query(
          `update profile.head set revision_id = $1::bigint, updated_at = now()
            where revision_id = $2::bigint returning singleton`,
          [revision, previous],
        );
  if (swapped.length === 0) throw new ProfileChangedError();
}
