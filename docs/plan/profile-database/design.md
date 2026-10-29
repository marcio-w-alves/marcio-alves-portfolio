# Design — Profile in a database, privacy cleanup of the repository (`profile-database`)

Status: draft for approval · Input: `prd.md` Rev. 1 (D1–D21, FR-1…FR-41, NFR-1…NFR-10, deliverables
D0–D9) · Author: solution architect · Date: 2026-10-28

This document decides **how** the PRD is built. Every section names the requirements it serves; §15 is the
traceability table. Where the PRD is underspecified or needs a correction, §14 says so and gives the fix.

---

## 0. Ground truth the plan must start from

Surveyed on `main` at `accd3cc` (the planning branch). POR-87 and POR-66 are assumed merged before D0
(PRD D14); nothing below depends on their content beyond Portuguese being published.

| Fact                                                                                                                                                                                                                                                                                                                                                                                                    | Consequence                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The whitelabel seam is real: the core receives the record and an `AnswerSet` (`src/core/assistant/answer-set.ts`) by injection; only `composition-root.ts`, `site-root.ts`, `global-error.tsx`, scripts and tests read `@/profile`.                                                                                                                                                                     | The data can move behind that seam without touching the fast path, the router, the site presenters or the UI. The `AnswerSet` port stays exactly as it is; only what produces it changes (§5).            |
| The answer copy is ~3,000 lines of TypeScript per two locales. Besides interpolation it uses: conditionals on record values, per-id overrides with defaults (`COMPANY_INTROS[id] ?? …`), list mapping/filtering, lookups keyed by record values, regex extraction (`award()`), `contactOnce(context)`, and three parameterized answers (`company`, `project`, `technology`) plus `languages(question)`. | A plain Mustache cannot express this without code lambdas, and Liquid/Handlebars carry more logic than we want and no static check against the record. A small, closed, statically checked language (§5). |
| `next.config.ts` imports `src/profile/locales.ts` at config time; `globals.css` imports `src/profile/generated/brand.css`; `composition-root.ts` imports `@/profile/generated/knowledge-index.json`; `global-error.tsx` (a client component) imports `fonts.ts` and `global-error-copy.ts`.                                                                                                             | Four static import edges into the profile. All four keep their paths; what sits behind them becomes **generated, git-ignored files** written before `next build` (§4).                                    |
| `public/` holds only the two owner assets.                                                                                                                                                                                                                                                                                                                                                              | `public/` can become a build artifact written by the materializer, so the same URLs serve bytes that came from the database (FR-14).                                                                      |
| `.dependency-cruiser.cjs` already forbids `src → scripts` and `src → devDependencies`.                                                                                                                                                                                                                                                                                                                  | Putting the Postgres adapter in `scripts/` and `pg` in `devDependencies` makes "no page or route can reach the database" true **by two existing rules** (NFR-9). A third, explicit rule names it.         |
| `src/testing/whitelabel.ts` already derives owner terms from a profile (`ownerTerms`, `recordFigures`, `ownerWords`) but prints the matched term.                                                                                                                                                                                                                                                       | The privacy scan reuses the derivation, never the reporting (FR-35).                                                                                                                                      |
| The remote holds 1 branch, 68 tags (lightweight, semantic-release), **68 `refs/notes/semantic-release-v*`**, 94 `refs/pull/*` (47 PRs), 309 commits across all refs; ~120 historical paths no longer exist at HEAD (old `src/core/knowledge/data/**`, `fidelity/reference/**`, workbench).                                                                                                              | The history rewrite must cover paths that exist only in the past, notes refs that map _old_ commit ids, and PR refs only GitHub can purge (§11).                                                          |
| The fixture's index is seeded (`src/testing/fixture-profile/fixture-index.ts`), not embedded.                                                                                                                                                                                                                                                                                                           | The example bundle keeps a seeded index: keyless, reproducible in CI, checked exactly (§3.6).                                                                                                             |
| No `vercel.json`; Vercel runs the `build` script of `package.json`.                                                                                                                                                                                                                                                                                                                                     | A `vercel.json` with an explicit `buildCommand` removes the ambiguity, and a second guard inside `next.config.ts` refuses a production build of the example (§4.4).                                       |

---

## 1. Decisions at a glance

| #   | Decision                       | Chosen                                                                                                                                                                                                                                                                                                                                                              | Why (alternatives rejected in the section)                                                                                                                                                                                                                                                                                                | Serves                     |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| B1  | How the build gets the profile | A **materialize step** (`pnpm profile materialize`) runs before `next build` and `next dev`: it selects a source (D8), reads it, runs every check, and writes git-ignored `src/profile/generated/*` plus `public/*`. The app imports only those files.                                                                                                              | Runtime never touches the DB (NFR-2). The Next build stays a pure function of files on disk. Fetching inside `next.config` or inside Server Components at build was rejected: it ties DB access to Next's lifecycle (`next start`, `typegen`), and puts the adapter in the app's module graph. §4                                         | FR-12, FR-13, NFR-2, NFR-9 |
| B2  | Storage model                  | **Postgres as a content-addressed document store**: immutable _revisions_, each a set of _documents_ (bundle path → blob), blobs keyed by SHA-256 in `bytea`, one `head` pointer swapped atomically.                                                                                                                                                                | The access pattern is "read the whole aggregate, validate, build" — one Repository for one aggregate. A normalized schema per record field would duplicate the zod model in SQL and make every record change a migration (database-driven design). Byte storage makes export→import exact (FR-8) and dedupes revisions. §3                | FR-1, FR-5–FR-8, D2, D4    |
| B3  | Binaries and index             | **`bytea`** for everything (PDF, photo, index, embeddings, text). No large objects, no JSONB for generated files.                                                                                                                                                                                                                                                   | Large objects need separate permissions, `lo_unlink` hygiene and are awkward over pooled connections; JSONB re-normalizes numbers and key order, so the index would no longer be byte-identical to what `rag:build` wrote. Total data is a few MB against Neon Free's 1 GB per project. §3.3                                              | D4, FR-14, D18             |
| B4  | Database driver                | **`pg` (node-postgres) over TCP + TLS**, `devDependency`, used only from `scripts/`.                                                                                                                                                                                                                                                                                | Everything that talks to the DB runs in Node (Vercel build container, owner's machine, CI). Neon's serverless driver exists for edge/serverless runtimes that cannot hold TCP; we have none. `pg` gives interactive transactions (import), native connect/query/statement timeouts, and is the driver Neon's own driver is based on. §3.4 | FR-6, NFR-6                |
| B5  | Bundle format                  | Directory of **YAML 1.2** (structured text), **Markdown** (long-form notes), **JSON** (generated: index, probes, notes, snapshot) and binaries. Parsed with the `yaml` package in strict mode. Lives in `profiles/example/` (committed) and outside the repo for the owner.                                                                                         | Prose with structure needs block scalars; JSON strings with `\n` are unusable for 3,000 lines of answers. YAML's pitfalls are closed by the core schema, unique keys, no merge keys and an alias cap. §2.3                                                                                                                                | D6, FR-5, FR-24            |
| B6  | Answer copy as data            | A **closed, logic-less template language** (`{{ }}` placeholders, filters from a fixed list, `#if/#each/#bullets/#numbered/#with`), compiled by the core into the _existing_ `AnswerSet`. Structure and policy (which sources an answer cites for technologies, slow-down follow-ups) move into the core; words stay in data.                                       | Keeps the fast path untouched (the port is unchanged), keeps `src/core` dependency-free, and lets the checker prove every placeholder resolves against the record before anything ships. §5                                                                                                                                               | D20, FR-20–FR-23           |
| B7  | Equivalence proof              | **Two independent proofs**: (1) an in-process _answer transcript_ of every intent × locale × parameter × context, deep-equal between the TS copy and the templates (CI, D2→D8); (2) the black-box **baseline** of the deployed site (pages, metadata, assets, fast-path answers, retrieval, pixels) captured before any change (D0) and compared at D4a, D6 and D7. | (1) catches a drift at the line that caused it; (2) catches everything the transcript cannot see (HTML, metadata, assets, CSS tokens). §6                                                                                                                                                                                                 | FR-21, FR-29, FR-30, D10   |
| B8  | Profile selection              | Explicit `PROFILE_SOURCE` (`database` \| `bundle` \| `example`) wins; otherwise `PROFILE_DATABASE_URL` → database, `PROFILE_BUNDLE_DIR` → bundle, not production → example, production → **fail**. Re-checked by `next.config.ts` from the manifest.                                                                                                                | One rule, evaluated twice (defense in depth), so production cannot silently ship the example even if someone runs `next build` directly. §4.3                                                                                                                                                                                             | D8, FR-13, AC-13.x         |
| B9  | Transition source              | During D4a–D7 production builds from an **in-repository owner bundle** (`profiles/owner/`, set by `PROFILE_BUNDLE_DIR` on Vercel). D7 switches the env to the DB; D8 deletes the folder.                                                                                                                                                                            | Decouples "the code reads bundles" (D4a, verified by baseline) from "the data comes from Neon" (D7, verified again). No code shim: the bundle source is a permanent feature (local preview, forks). §12                                                                                                                                   | G3, NFR-8, D21             |
| B10 | Publish                        | `pnpm profile publish` calls the **Vercel REST API** (`POST /v13/deployments?forceNew=1`, `target: production`, `gitSource {type: github, repoId, ref: main, sha}`), prints the deployment URL and inspector URL, optionally waits for `READY`.                                                                                                                     | Deploy Hooks return only a job id (no URL, AC-18.1) and have documented cases of accepted jobs that never deploy. `forceNew=1` is required because the commit is unchanged while the data changed. `repoId` survives the repo rename. §8                                                                                                  | FR-18, AC-18.1             |
| B11 | Roles and secrets              | Two login roles: `profile_owner` (owns the schema; owner's machine only) and `profile_reader` (`SELECT` only, `default_transaction_read_only = on`). Build/CI hold only the reader URL, as a Vercel _Sensitive_ env var and a GitHub secret. **Do not use the Vercel–Neon marketplace integration** (it injects the owner role into every environment).             | Least privilege; rotation is an `ALTER ROLE … PASSWORD` plus two env updates, no code (NFR-5). §7                                                                                                                                                                                                                                         | FR-2, NFR-5, D9            |
| B12 | Privacy scan                   | `pnpm privacy:scan` (tree and history modes) derives terms from a profile read from the DB or a local bundle, matches by kind, reports `path:line:col kind=… term#n` only, masks every term in GitHub logs, refuses `--reveal` under `CI`.                                                                                                                          | Public CI logs never carry a term (FR-35), while the owner can still resolve `term#n` locally. §10                                                                                                                                                                                                                                        | FR-34–FR-36, NFR-1         |
| B13 | History rewrite                | `git filter-repo --sensitive-data-removal` with path, blob-id, text and message expressions and a mailmap, **`--prune-empty never --prune-degenerate never`**; notes refs re-created from the commit map; releases re-noted with the release-notes generator; GitHub Support for `refs/pull/*`.                                                                     | GitHub's own procedure, plus the two prune flags that keep the commit count (AC-37.1) and a HEAD-tree identity check that proves the rewrite changed history only. §11                                                                                                                                                                    | D11, FR-37–FR-41           |

---

## 2. Architecture and target structure

### 2.1 Bounded contexts and dependency direction

Two contexts meet at one Published Language:

- **Profile authoring & publishing** (tooling, `scripts/profile/**`): bundles, the store, revisions,
  import/export/diff, checks, materialization, publish. Its model: _ProfileBundle_ (a set of _documents_),
  _Revision_, _Head_, _Workspace_ (where a script reads and writes: a bundle directory or the database).
- **The site** (`src/**`): reads a _Materialized profile_ — JSON plus assets on disk — and never knows
  where it came from.

The _Materialized profile_ (`src/profile/generated/*`, schema in `src/profile/schema.ts`) is the
contract between them. Tooling imports the contract from `src`; `src` never imports tooling.

```
            ┌──────────────── scripts/  (build-time & owner tooling, Node, devDependencies) ───────────────┐
            │  scripts/profile.mts (CLI)                                                                    │
            │    commands/ materialize · check · init · migrate · import · export · diff · revisions ·    │
            │              restore · publish · status                                                       │
            │    workspace/  BundleDirectory ─┐        store/ PostgresProfileStore (pg)  ─── Neon (TLS)    │
            │                                 ├─▶ ProfileWorkspace port ◀─┘                                 │
            │    bundle/   layout · read-directory · decode (yaml)                                         │
            │    checks/   schema · translations · sites · index · assets · evaluation · copy · graph      │
            │    vercel/   VercelDeployments (fetch, timeouts)                                              │
            │  scripts/privacy/** · scripts/baseline/** · scripts/purge/**                                 │
            └───────────────┬──────────────────────────────────────────────────────────────┬──────────────┘
                            │ imports (schema, core helpers)                                │ writes files
                            ▼                                                               ▼
   ┌──────── src/ (shipped) ─────────────────────────────────┐        src/profile/generated/*.json, brand.css
   │ roots: composition-root.ts · site-root.ts · env.ts      │        src/testing/fixture-profile/generated/*
   │ src/profile   loader (index.ts) · schema.ts · fonts.ts  │◀────── public/<asset paths>
   │               publication.ts · global-error-copy.ts     │  imports the generated JSON only
   │ src/site · src/http · src/ui · src/infrastructure       │
   │ src/core      … assistant/copy/ (template engine)       │  framework-free, no new dependency
   └─────────────────────────────────────────────────────────┘
```

Dependency Rule checks:

- `src/core/assistant/copy/**` is plain TypeScript (zod allowed by ADR 0001). It depends on
  `core/assistant` types and `core/knowledge`, never outward.
- `src/profile/index.ts` calls the core's `compileLocaleCopy` — profile → core is the legal direction.
- The Postgres adapter, `pg`, `yaml` decoding and the Vercel client live in `scripts/`. A page, route,
  root or adapter importing them is a `src-never-imports-scripts` error already; a new rule
  `no-runtime-profile-store` forbids `^src/` → `node_modules/(pg|yaml)/` explicitly, so the guarantee
  survives anyone moving `pg` into `dependencies`.

### 2.2 Ports inside the tooling context (DIP)

```ts
// scripts/profile/workspace/workspace.ts — owned by the use cases, implemented by two adapters
export interface ProfileDocuments {
  readonly format: number; // bundle format version (bundle.yaml)
  readonly documents: ReadonlyMap<string, Document>; // bundle path → document
}
export interface Document {
  readonly mediaType: MediaType;
  readonly bytes: Uint8Array;
}
export interface WorkspaceRevision {
  readonly id: string;
  readonly digest: string;
} // id "dir" for bundles

export interface ProfileWorkspace {
  read(): Promise<{ revision: WorkspaceRevision; profile: ProfileDocuments }>;
  /** Writes a whole new revision; `expected` is the revision the change was computed from. */
  write(change: RevisionChange, expected: WorkspaceRevision): Promise<WorkspaceRevision>;
}
export interface RevisionChange {
  readonly put: ReadonlyMap<string, Document>;
  readonly remove: readonly string[];
  readonly origin: 'import' | 'rag-build' | 'notes-build' | 'sites-ingest' | 'restore';
  readonly note?: string;
}
```

Adapters: `BundleDirectory` (fs; writes files, refuses symlinks and paths outside the layout) and
`PostgresProfileStore` (§3). Use cases (`materialize`, `import`, `export`, `diff`, `rag-build`, …) take a
`ProfileWorkspace` and a `Backups` port (`write(profile) → path`), so they are tested with an in-memory
workspace; the adapters get their own integration tests (§13).

### 2.3 Target tree (after D8)

```
profiles/
  README.md                     what a bundle is; points at docs/profile/
  example/                      the shipped example profile (Ada Rivera), a bundle (§3.6)
scripts/
  profile.mts                   CLI entry: `pnpm profile <command>`
  profile/{commands,workspace,store,bundle,checks,vercel,home.ts,select-source.ts,materialize.ts}
  profile/store/migrations/0001_profile_store.sql
  privacy/{terms.ts,scan-tree.ts,scan-history.ts,report.ts,scan.mts}
  baseline/{enumerate.mts,capture.mts,compare.mts,normalize.ts,...}
  purge/{mailmap.mts,notes-refs.mts,release-notes.mts,pr-report.mts}
  build-knowledge-index.mts, build-retrieval-probes.mts, build-knowledge-notes.mts,
  ingest-sites.mts, evaluate-assistant.mts          (now read/write the selected workspace)
src/
  core/assistant/copy/          template language, copy-document schema, compiler (§5)
  core/knowledge/figures.ts     recordFigures(), moved from src/testing/whitelabel.ts
  profile/
    index.ts                    loads generated/profile.json → validated, compiled Profile
    schema.ts                   ProfileData (materialized contract) + Profile (runtime) + validation
    publication.ts              reads generated/manifest.json for next.config (locales, provenance)
    identifying-terms.ts        ownerTerms/ownerWords, moved from src/testing/whitelabel.ts
    evaluation.ts               EvaluationCase / CalibrationItem types + zod schemas
    fonts.ts                    the bundled faces (literal next/font calls), not profile data
    global-error-copy.ts        reads generated/global-error.json (client-safe: the name only)
    generated/                  git-ignored, written by `pnpm profile materialize`
  testing/fixture-profile/      loads the example's materialization (same exported names as today)
docs/profile/README.md          bundle reference, setup, editing, publishing (D5)
docs/profile/database.md        Neon, roles, schema, backups and restore (D3, completed in D5)
docs/adr/0011…0013              §9
vercel.json                     { "buildCommand": "pnpm build" }
```

Removed by D8: `src/profile/{identity,brand,locales,retrieval-probes}.ts`, `src/profile/{copy,knowledge,
evaluation,sites}/**`, `src/profile/*.test.ts`, `src/profile/README.md`, `profiles/owner/**`,
`public/*` (tracked), the TS fixture (`src/testing/fixture-profile/{answers,knowledge,identity,brand,
copy,profile,fixture-index}.ts`, gone in D4a), `scripts/{generate-brand-css,build-fixture-index}.mts`,
`docs/plan/i18n-whitelabel/**` and this plan's `prd.md`/`design.md`/`test-plan.md`/`index.html` (the owner
keeps them in his local export; `resume.md` stays, written owner-term-free).

---

## 3. The profile store (D3; FR-1, FR-2, FR-4–FR-11, NFR-5, NFR-6)

### 3.1 Bundle layout (the documents)

| Path (`<locale>` ∈ published locales)                                                               | Media type         | Holds                                                                                           | Was                                   |
| --------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| `bundle.yaml`                                                                                       | `application/yaml` | `format: 1`, `locales: [en, pt-BR]`                                                             | `locales.ts`                          |
| `identity.yaml`                                                                                     | yaml               | `Identity` (+ `sourceRepository` URL, used by the about page)                                   | `identity.ts`, `REPOSITORY` in about  |
| `brand.yaml`                                                                                        | yaml               | colours, dark colours, per-role `face` (enum of bundled faces) + fallbacks/features, image font | `brand.ts`, `fonts.ts` choice         |
| `knowledge/{profile,experience,metrics,projects,skills,education,practice,references,sources}.yaml` | yaml               | the `KnowledgeSource` record, `Localized` leaves inline as today (`{en: …, pt-BR: …}`)          | `knowledge/*.ts`                      |
| `knowledge/knowledge-base.md`                                                                       | `text/markdown`    | long-form notes (source)                                                                        | same                                  |
| `knowledge/notes-guide.md`                                                                          | markdown           | the evidence-tag guide, a template (`{{first}}`)                                                | `notes-guide.ts`                      |
| `sites/allow-list.yaml`                                                                             | yaml               | `SiteEntry[]`                                                                                   | `sites/allow-list.ts`                 |
| `copy/<locale>/answers/*.yaml`                                                                      | yaml               | answer documents (one top-level key per answer id; file split is free)                          | `copy/<locale>/answers/*.ts`          |
| `copy/<locale>/{topics,vocabulary,ui,site,about}.yaml`                                              | yaml               | topic pages; router vocabulary; interface and page overrides; about page                        | `topics.ts`, `index.ts`, `ui.ts`, …   |
| `evaluation/{cases,calibration}.yaml`                                                               | yaml               | evaluation cases (YAML anchors replace `LEAK_MARKERS`), judge calibration                       | `evaluation/*.ts`                     |
| `retrieval/probes.yaml`                                                                             | yaml               | retrieval probes: `id: question`                                                                | `retrieval-probes.ts`                 |
| `privacy.yaml`                                                                                      | yaml               | extra privacy terms the record cannot derive: `phone`, `address`, `phrases` (§10.1)             | new                                   |
| `assets.yaml` + `assets/<file>`                                                                     | yaml + binary      | `- {file: assets/resume.pdf, path: /<name>.pdf, mediaType: application/pdf}`                    | `public/*`, `photoUrl`/`resumeUrl`    |
| `generated/{notes,knowledge-index,retrieval-probes}.json`, `sites/snapshot.json`                    | `application/json` | written by `notes:build`, `rag:build`, `rag:probes`, `sites:ingest` — never by hand             | `knowledge/notes.json`, `generated/*` |

Rules enforced by `bundle/read-directory.ts` and the import (each violation names the path):

- Only paths in the layout; dotfiles are ignored (macOS `.DS_Store`); symlinks are refused; path segments
  match `[A-Za-z0-9][A-Za-z0-9._-]*`.
- Text documents are UTF-8 without BOM and **without CR** (a CRLF template would render `\r\n` and break
  equivalence); the error says "save with LF line endings".
- Limits: ≤ 400 documents, assets ≤ 10 MiB each and only PDF/JPEG/PNG/WebP with matching magic bytes,
  any document ≤ 25 MiB, bundle ≤ 50 MiB. Bounded reads keep the build's result set bounded.
- YAML parsed with `yaml` 2.x: `{ version: '1.2', schema: 'core', uniqueKeys: true, merge: false,
strict: true, maxAliasCount: 100 }` — no implicit `yes`/`no` booleans, no duplicate keys, no alias bombs.

The bundle format version (`format`) is checked on decode; code supports exactly its current version.
The first breaking format change ships an `upgrade` command that rewrites a workspace into a new revision;
additive changes do not bump it (tolerant reader).

### 3.2 Data model (DDL, migration `0001_profile_store.sql`, run as `profile_owner`)

```sql
-- The schema itself and the two roles are created by `pnpm profile init` (§7.1).

create table profile.blob (
  sha256 bytea primary key,
  bytes  bytea not null,
  constraint blob_is_content_addressed check (sha256 = pg_catalog.sha256(bytes)),
  constraint blob_size check (octet_length(bytes) <= 26214400)          -- 25 MiB
);

create table profile.revision (
  id            bigint generated always as identity primary key,
  digest        bytea not null unique check (octet_length(digest) = 32), -- sha256 of the manifest (§3.3)
  bundle_format integer not null check (bundle_format > 0),
  origin        text not null check (origin in
                  ('import','rag-build','notes-build','sites-ingest','restore','sql')),
  note          text check (length(note) <= 500),
  created_at    timestamptz not null default now(),
  created_by    text not null default current_user
);

create table profile.document (
  revision_id bigint not null references profile.revision (id) on delete cascade,
  path        text collate "C" not null,
  media_type  text not null,
  blob_sha256 bytea not null references profile.blob (sha256),
  primary key (revision_id, path),
  constraint document_path check (
    path ~ '^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)*$'),
  constraint document_media_type check (media_type in ('application/yaml','text/markdown',
    'application/json','application/pdf','image/jpeg','image/png','image/webp'))
);
create index document_blob on profile.document (blob_sha256);

create table profile.head (
  singleton   boolean primary key default true check (singleton),
  revision_id bigint not null references profile.revision (id),        -- RESTRICT: head is never pruned
  updated_at  timestamptz not null default now()
);

create function profile.forbid_update() returns trigger language plpgsql as
  $$ begin raise exception 'profile revisions are immutable; write a new revision'; end $$;
create trigger revision_immutable before update on profile.revision
  for each row execute function profile.forbid_update();
create trigger document_immutable before update on profile.document
  for each row execute function profile.forbid_update();

-- SQL editing path (D5 b): a new revision from head with some text documents replaced or removed.
-- Computes the digest exactly like the client (§3.3). Validation runs at the next build.
create function profile.revise(changes jsonb, note text) returns bigint language plpgsql as $$ … $$;
```

`profile.schema_migration(version int primary key, name text, checksum bytea, applied_at timestamptz)` is
created by the migration runner. Reader grants: `usage` on schema `profile`, `select` on `blob`,
`revision`, `document`, `head` (explicit list, plus `alter default privileges … grant select on tables`
so a future table is readable only when a migration says so).

### 3.3 Integrity, reads and writes

- **Manifest and digest.** `manifest = join('\n', sort_bytewise(paths).map(p => p + '\t' + mediaType +
'\t' + hex(sha256(bytes))))`; `digest = sha256(utf8(manifest))`. SQL sorts with `collate "C"` so both
  sides agree. Equal digest ⇒ identical profile, which makes import idempotent and FR-8 checkable.
- **Build read** (reader role, one round trip each, in
  `begin isolation level repeatable read read only`):
  `select r.id, r.digest, r.bundle_format from profile.head h join profile.revision r on r.id = h.revision_id`
  then `select d.path, d.media_type, b.bytes from profile.document d join profile.blob b on b.sha256 =
d.blob_sha256 where d.revision_id = $1 order by d.path`. The client re-hashes every blob and the manifest;
  a mismatch fails the build ("stored profile is corrupt") rather than shipping it. An empty `head` fails
  with "the database holds no profile yet — import a bundle".
- **Import / write** (owner role), one transaction, `isolation level serializable`:
  1. `insert into profile.blob … on conflict (sha256) do nothing` for each new blob;
  2. insert the revision (digest, format, origin, note) and its documents;
  3. `update profile.head set revision_id = $new, updated_at = now() where revision_id = $expected`
     (insert on first import). **0 rows ⇒ abort**: someone wrote since the backup was taken
     ("the profile changed since your backup; run the import again").
  4. Commit. A crash or a timeout before commit leaves the previous head (AC-6.2).
- **Retention (Steady State).** After a successful write, a separate transaction keeps the newest 20
  revisions plus head and deletes orphan blobs. Twenty revisions of a few MB with dedup stay far below the
  free plan's storage.
- **Restore** inside the DB: `pnpm profile restore <revision>` writes a _new_ revision whose documents equal
  the old one (origin `restore`), so history stays append-only.

### 3.4 Connection, timeouts, retries (NFR-6, NFR-2, AC-13.2)

`scripts/profile/store/connect.ts` builds a `pg.Client` from the URL with explicit settings, never from
`sslmode` parsing alone:

| Setting                               | Value                                                                          | Why                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `ssl`                                 | `{ rejectUnauthorized: true, servername: host }`; `enableChannelBinding: true` | TLS required and verified (NFR-5); Neon supports SCRAM channel binding. |
| `connectionTimeoutMillis`             | 10 000                                                                         | covers a scale-to-zero wake-up (Free computes suspend after 5 min).     |
| `statement_timeout` / `query_timeout` | 15 000 / 20 000                                                                | a few-MB read takes well under a second.                                |
| `lock_timeout`                        | 5 000                                                                          | import never waits behind a stuck session.                              |
| `idle_in_transaction_session_timeout` | 30 000                                                                         | a killed CLI never holds a transaction open.                            |
| `application_name`                    | `profile-<command>`                                                            | identifies sessions in Neon's monitoring.                               |

Reads retry **3 attempts**, exponential backoff with full jitter (base 1 s, cap 8 s), only on connection
errors (`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND` excluded — it is a config error — SQLSTATE class `08`,
`57P01`, `57P03`). Worst case ≈ 3 × 10 s + 7 s < 60 s (NFR-2). Writes are not retried automatically: the
import is idempotent by digest, so the owner re-runs it and an already-applied import reports "no changes".
A circuit breaker is deliberately absent: there is no long-running caller to protect — each CLI run makes
at most three attempts and exits, which is the breaker's open state.

Error messages name host, operation, attempt count and SQLSTATE, **never the URL or a credential**; the
URL is parsed once and never interpolated into a message or log line.

### 3.5 Local homes, backups and the commands (FR-5–FR-11)

`PROFILE_HOME` (default `${XDG_DATA_HOME:-~/.local/share}/portfolio-profile`, created `0700`, files
`0600`) holds `bundles/`, `backups/`, `baseline/`, `purge/`, `credentials/`. `home.ts` refuses any write
target that resolves inside a git work tree of this repository (`git rev-parse --show-toplevel` prefix
check after `realpath`) — the reason FR-9/AC-9.1 holds is that the tool cannot write there, not that
`.gitignore` hides it.

| Command                                   | Role           | Does                                                                                                                                                                           |
| ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm profile init`                       | admin          | Creates `profile_owner`, `profile_reader` (256-bit random passwords, written to `credentials/<host>.env`, never printed), the schema, then runs `migrate`. One command (FR-4). |
| `pnpm profile migrate`                    | owner          | Applies pending `migrations/*.sql` in order, each in a transaction under `pg_advisory_xact_lock`; refuses if an applied migration's checksum changed.                          |
| `pnpm profile export [dir]`               | reader         | Writes head's documents byte-for-byte into `dir` (default `bundles/<host>-rev<id>/`), plus nothing else. Refuses a non-empty target.                                           |
| `pnpm profile check <dir>`                | —              | Decodes and runs every check (§4.2) on a bundle; writes nothing.                                                                                                               |
| `pnpm profile diff <dir>`                 | reader         | FR-11: added/changed/removed documents grouped by content type; for YAML documents, the changed top-level keys (answer ids, role ids…). Prints ids, never values.              |
| `pnpm profile import <dir> [--note]`      | owner          | `check` → read head → digest equal ⇒ "no changes" → **backup export to `backups/<UTC>-rev<id>/`, re-read and hash-verified, path printed** → write (§3.3) → prune.             |
| `pnpm profile revisions` / `restore <id>` | reader / owner | Lists revisions (id, digest prefix, origin, note, time); restores as a new revision, with the same backup step.                                                                |
| `pnpm profile materialize` / `status`     | reader         | §4. `status` prints the materialized source, revision and digest prefix.                                                                                                       |
| `pnpm profile publish [--wait]`           | Vercel token   | §8.                                                                                                                                                                            |

Backup policy (FR-10, written in `docs/profile/database.md`): three layers — (1) revision history in the DB
(newest 20, instant `restore`); (2) Neon instant restore, **6 hours on the Free plan** (verify the window in
the console; the doc records the plan in use and the procedure: Branches → Restore, or restore to a new
branch and inspect first); (3) local exports, unbounded — automatic before every write, plus a manual
`pnpm profile export` after each publish and at least weekly while editing. AC-10.1 is exercised on a
throw-away Neon branch.

### 3.6 The example bundle (D7)

`profiles/example/` is the TS fixture converted: Ada Rivera, `en` + `pt-BR`, her answers as templates, a
neutral placeholder photo (`/ada-rivera.jpg`, 512×512 JPEG) and a one-page example résumé
(`/ada-rivera-resume.pdf`). Both binaries are produced once by `scripts/example/render-example-assets.mts`
(Playwright `page.screenshot({type:'jpeg'})` and `page.pdf()` from HTML built from the example record —
already devDependencies), committed, and reproducible. Its `generated/knowledge-index.json` is the seeded
index (today's `buildFixtureIndex`, now `pnpm rag:build --seeded` over the selected bundle); a check fails
when the committed file differs from the seeded build. Its `privacy.yaml` lists fictional phone/phrases so
the scan's own tests have a profile to run against (AC-25.1).

---

## 4. Build pipeline (D4a/D4b; FR-12–FR-19, NFR-2–NFR-4, NFR-9)

### 4.1 Sequence

```
pnpm build  ≡  pnpm profile materialize && next build          (vercel.json buildCommand: "pnpm build")

materialize
 1. select source (§4.3)                  → error names the missing setting, exit 1
 2. workspace.read()                      → DB: ≤ 3 attempts, < 60 s; bundle: directory read with limits
 3. decode documents → ProfileData        → YAML/JSON parse errors with path:line:col
 4. checks (§4.2)                         → every problem by path, exit 1
 5. write, atomically (temp dir + rename):
      src/profile/generated/profile.json            ProfileData (validated, serializable)
      src/profile/generated/knowledge-index.json    bytes as stored
      src/profile/generated/retrieval-probes.json   bytes as stored
      src/profile/generated/brand.css               renderBrandCss(brand)
      src/profile/generated/global-error.json       { name }
      src/profile/generated/manifest.json           { source, revision, digest, format, locales, materializedAt }
      public/<asset path>                           bytes as stored; previous run's files removed via
                                                    public/.materialized.json (only files it wrote)
      src/testing/fixture-profile/generated/*       the example's materialization, always (tests pin it)
 6. log: source, revision, digest prefix, document count, duration — never values

next build
 - next.config.ts → src/profile/publication.ts reads manifest.json: locales for rewrites, and
   assertProfileFitsDeployment(manifest, env) (§4.3) — the second guard
 - globals.css imports generated/brand.css; roots import @/profile (generated/profile.json);
   composition-root imports generated/knowledge-index.json (path unchanged); public/ copied as today
```

`next start`, the API functions and the pages read only those files. Nothing at runtime imports the store
(NFR-2, AC-12.1); `e2e/bundle.spec.ts` additionally asserts no server chunk references
`PROFILE_DATABASE_URL` or `pg` (artifact-level proof).

`pnpm dev` runs the same `materialize` first. `prepare` (after every `pnpm install`) runs
`materialize --if-absent --example`: a fresh clone and every CI job have a working example
materialization without credentials (FR-24, NFR-3); it never touches the DB, so a Vercel install does not
read it twice. `typecheck`, `lint`, `boundaries` and `test` use whatever is materialized; a Vitest
`globalSetup` fails with "run `pnpm profile materialize`" if `manifest.json` is missing.

### 4.2 Checks (D17; FR-3, FR-15, FR-22, AC-3.1, AC-22.1) — run on materialize, `check`, `import`

| Check                  | Rule                                                                                                                                                                                                                                                                      | Source today                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| schema                 | `profileDataSchema` (identity, brand incl. face enum, record via `knowledgeRecordSchema`, allow-list, evaluation, probes, assets, privacy)                                                                                                                                | `validateProfile`                   |
| translations           | `checkPublishedLocalesWritten` (every text written, same figures) on the record; every published locale's copy has the same answer ids and topics as `en`, and each template names the same set of fact paths as its `en` twin unless it declares `factsDiffer: <reason>` | `translations.test.ts` (owner test) |
| sites                  | `checkSitePassagesAllowed`                                                                                                                                                                                                                                                | schema refinement                   |
| index                  | `corpusHash(buildCorpus(record)) === index.corpusHash`; model/dimensions equal `index-spec`; one vector per passage; one probe vector per probe question                                                                                                                  | `generated/knowledge-index.test.ts` |
| notes                  | `parseNotes(knowledge-base.md)` deep-equals `generated/notes.json`                                                                                                                                                                                                        | `notes.test.ts`                     |
| assets                 | every same-origin asset URL in the record (`photoUrl`, `resumeUrl`) is in `assets.yaml`; magic bytes match; asset paths are top-level and do not collide with routes (`/api`, `/en`, `/pt`, `/icon`, `/apple-icon`, `/robots.txt`, `/sitemap.xml`, `/_next`)              | new                                 |
| evaluation             | unique case ids; every `cites` id is a source id; calibration actions name registered tools                                                                                                                                                                               | `cases.test.ts`                     |
| copy (D2)              | every template parses, every path and id resolves, no literal record figure, every answer renders for every parameter value (§5.4)                                                                                                                                        | TypeScript + owner tests            |
| overrides (D4a)        | every `ui`/`site` override key exists in the default catalog with the same shape (string vs plural)                                                                                                                                                                       | TypeScript (`Overrides<T>`)         |
| suggestion graph (D4a) | every follow-up and topic question, in every locale, routes to a fast-path answer                                                                                                                                                                                         | `routing.test.ts`, guide tests      |

A check failure prints `<document>#<pointer>: <problem> — <what to do>`. AC-3.1 (a Portuguese text adding
a figure fails the build) is the translations check on the DB source.

### 4.3 Selection (D8; FR-13, AC-13.1, AC-13.2)

```ts
// scripts/profile/select-source.ts — pure, unit-tested on a table of env combinations
type Source =
  { kind: 'database'; url: string } | { kind: 'bundle'; dir: string } | { kind: 'example' };

export function selectSource(env: Env): Source; // throws SelectionError(message names the setting)
```

1. `PROFILE_SOURCE` set → that source; `database` requires `PROFILE_DATABASE_URL`, `bundle` requires
   `PROFILE_BUNDLE_DIR`, `example` is the explicit opt-in (a fork deploying the example on purpose).
2. Unset: both URL and dir set → error (ambiguous); URL → database; dir → bundle;
   `VERCEL_ENV !== 'production'` → example; production → error:
   "Production builds need a profile: set PROFILE_DATABASE_URL (read-only), or PROFILE_SOURCE=example to
   deploy the example on purpose."

`assertProfileFitsDeployment(manifest, env)` in `src/profile/publication.ts` repeats the production rule
inside `next.config.ts`: production with `manifest.source === 'example'` and no `PROFILE_SOURCE=example`
throws. The DB being unreachable never falls back: the database source either reads or exits non-zero.

Scripts that **write** (`rag:build`, `rag:probes`, `notes:build`, `sites:ingest`) select a writable
workspace: `PROFILE_OWNER_DATABASE_URL` → database (owner); else `PROFILE_BUNDLE_DIR` → that bundle; else
`profiles/example`. `eval:assistant` runs `materialize` first and reads cases and calibration from the
materialized profile (FR-15–FR-17, AC-16.1, AC-17.1). Each script logs which workspace it used.

### 4.4 The four config-time imports, and fonts (FR-19, D19)

- `next.config.ts`: `import { publication } from './src/profile/publication'` — `readFileSync` of
  `src/profile/generated/manifest.json` + zod; no import of the large profile.
- `globals.css`: unchanged import of `../profile/generated/brand.css`.
- `fonts.ts` becomes a **registry of the template's bundled faces** with literal `next/font` calls, one CSS
  variable per face (`--font-face-inter`, `--font-face-inter-tight`, `--font-face-geist-mono`), and no
  profile import — so the client-side global error page can keep importing it. `brand.yaml` picks a face
  per role from that enum; `renderBrandCss` maps `--font-sans: var(--font-face-<face>), <fallbacks>`.
  Adding a face is a template change (D19). The share image keeps `imageFont.files` (node_modules paths),
  validated to exist.
- `global-error.tsx` imports `global-error-copy.ts`, which reads `generated/global-error.json` (the name
  only) — the client bundle gets exactly what it gets today.

### 4.5 Loader (`src/profile/index.ts`)

```ts
import data from './generated/profile.json';
/** The selected profile, as materialized before the build. Read only by the roots, the scripts and the tests. */
export const profile: Profile = loadProfile(data);
```

`loadProfile` (in `schema.ts`) parses `profileDataSchema` (boundary validation, cheap), then for each locale
`compileLocaleCopy(copyData, { locale, limits, identity })` → `LocaleCopy { answers: AnswerSet, ui, site,
about? }`. The returned `Profile` has the same shape consumers use today, so `composition-root.ts`,
`site-root.ts`, `src/site/**`, `e2e/support/profile.ts` are unchanged. Exhaustive rendering is a
materialize-time check, not a cold-start cost.

---

## 5. Answers and copy as data (D2; FR-20–FR-23, D20)

### 5.1 Copy documents

```yaml
# copy/en/answers/career.yaml — one key per answer id
career:
  parts:
    - text: |-
        {{first}} is a frontend engineer with **{{profile.yearsLabel | replace "^(\d+)\+" "over $1"}}** of
        professional experience. He started in {{profile.careerStartYear}} as …
    - text: "### How his scope grew\n{{practice.careerArc | bullets}}"
    - timeline: all
    - metrics: [m-critical-load, m-web-vitals]
  followUps:
    - 'What has he built at {{role.r1.company}}?'
  sources: [profile, $roles, notes]
  related: r1

company: # parameterized: `role` is bound by the compiler to each role
  intro:
    byId:
      r1: '{{first}} worked at **{{role.company}}** from {{role.years.from}} to {{role.years.to}} as …'
    default: '{{first}} worked at **{{role.company}}** as {{role.role | withArticle}} ({{role.period}}).'
  parts:
    - text: '{{intro}}'
    - { text: '### Impact', when: role.metrics }
    - { metrics: { from: role.metrics }, when: role.metrics }
    - text: "### What the work involved\n{{role.responsibilities | bullets}}"
    - { text: "### Leadership\n{{role.leadership | bullets}}", when: role.leadership }
    - when: practice.caseStudies[role.id]
      text: "### The engineering problem\n{{#with practice.caseStudies[role.id]}}{{.problem}}\n\n{{.angles | bullets}}{{/with}}"
  followUps: { byId: { r1: […] }, default: […] }
  sources: ['{{role.source}}', { id: notes, when: 'practice.caseStudies[role.id]' }]
  related: '{{role.id}}'
```

(Ids above are illustrative.) The zod schema lives in `src/core/assistant/copy/copy-document.ts`:

- **Answer** = `{ parts: Part[], followUps: TemplateList, sources: SourceRef[], related?: Template,
grounded?: boolean, strings?: Record<string, Template>, factsDiffer?: string }`; any template-valued field
  of a parameterized answer may be `{ byId: Record<id, …>, default: … }` (resolved by the parameter's id).
- **Part** (each may carry `when: <condition>`): `text`, `note {tone, text}`, `details {summary, text}`,
  `table {columns, rows: Template[][] | {each, cells}, caption}`, `metrics: ids | {from: path}`,
  `timeline: all | ids`, `skills: all | ids`, `projects: all | ids | {from: path}`, `contactCard`,
  `contactOnce`. Each maps to the existing `response-kit` builder, so output parts are produced by the same
  code as today.
- **SourceRef**: an id, a template (`"{{role.source}}"`), `{id, when}`, or a core-provided set: `$roles`
  (`allRoleSources`), `$sites` (`siteSources` of the answer's subject).
- **Topics** (`topics.yaml`): `{label, intro, description, questions: [{question, tag, short?}], page: Part[]}`
  per topic id. **Vocabulary**: `intent: [{pattern, weight, flags?}]` (flags ⊆ `iu`; compiled once).
- **ui/site** overrides stay the existing interface format with **single-brace** `{firstName}` placeholders
  filled by `src/core/i18n/format.ts` in the browser — deliberately not the answer language, so the two can
  never be confused. **about.yaml**: `{label, title, description, markdown}`, rendered once at load with
  `{{limits.*}}` (core constants) and `{{identity.sourceRepository}}`.

### 5.2 Template language (in `src/core/assistant/copy/`)

```
template := (literal | tag)*
tag      := "{{" "~"? body "~"? "}}"          ~ trims adjacent whitespace on that side; nothing else trims
body     := pipeline | "#if" cond | "else" | "else if" cond | "/if"
          | "#each" pipeline ("sep=" string)? | "/each"
          | "#bullets" pipeline | "/bullets" | "#numbered" pipeline | "/numbered"
          | "#with" pipeline | "/with" | "!" comment
pipeline := value ("|" filter arg*)*
value    := path | string | integer
path     := name ("." name | "[" path "]")* | "." name? | name := [A-Za-z_][A-Za-z0-9_-]*
cond     := and ("or" and)* ; and := not ("and" not)* ; not := "not" not | "(" cond ")" | cmp
cmp      := pipeline (("==" | "!=") string)?
string   := '"' (char | \n | \" | \\)* '"'
```

- **Scope roots**: `first`; `profile`, `contact`, `education`, `languages`, `certifications`, `skills`,
  `principles`, `practice`, `projects`, `experience` (the localized `Knowledge`); `role.<id>`,
  `project.<id>`, `metric.<id>`, `skillGroup.<id>` (by id); `extract.<name>` (declared regex extractions,
  §5.3); `strings.<name>` (the answer's own strings); `limits.*`, `identity.*` (about page only); and the
  answer's parameters (`role`, `project`, `evidence`, `documented`, `asked`, `others`). Inside a block, `.`
  is the current item.
- **Derived facts** (computed by the core from the record, generic for any profile): `role.<id>.{years.from,
years.to, start}`; `metric.<id>.{value, amount (strips ~ and trailing +), before, after, delta}` for
  `"a → b"` values.
- **Filters** (closed list; each with typed input, arity, and a locale table where it is grammar):
  `words` (integer → number word, per-locale lexicon, else digits), `withArticle` (`en` only; "a"/"an"),
  `list` ("A, B and C" / "A, B e C"), `monthYear` (`YYYY[-MM]` → `Intl` long month + year, UTC),
  `capitalize`, `lowerFirst`, `lower`, `replace <regex> <replacement>`, `matching <regex>` (keep list items
  that match), `where <field>` / `whereNot <field>`, `except <path>`, `map <field>`, `first`, `count`,
  `join <string>`, `bullets`, `numbered`. A filter missing from a locale's lexicon is a check error.
- **Semantics**: rendering is strict — an unknown path, an unknown id, a non-string/number interpolation,
  or a filter on the wrong type is an error with `<document>#<answer>.<field>:<line>:<col>`. Falsy values:
  `null`, `false`, `""`, `[]` (zero is truthy, unlike JS). No HTML escaping (output is the Markdown the
  answers already are, rendered by the existing safe renderer).
- **Safety**: no evaluation of code, no access beyond own data properties (`Object.hasOwn` walk;
  `__proto__`, `prototype`, `constructor` rejected at parse time); regex arguments ≤ 200 characters,
  compiled once at check time, and applied only to record strings — the visitor's question is never in a
  template's scope (`languages` receives `asked`, computed by core code), so no template regex sees visitor
  input.

### 5.3 What moves into the core, and what stays words

The rule: **structure and citation policy are code; wording is data.**

| TS construct today                                                                  | Becomes                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `facts.ts` (`employer`, `period`, `years`, `startMonth`, `amount`, `countsInWords`) | derived facts + filters (`role.x.company`, `role.x.start \| monthYear`, `metric.x.before \| words`)                                                                                     |
| `award()` regex over a role's achievements                                          | an `extract` declaration in `copy/<locale>/facts.yaml`: `{from: role.r.achievements, pattern, groups: [name, year]}`; it must match exactly once, else a check error (as today's throw) |
| `metric === '50%' ? 'halved …' : …`                                                 | `{{#if metric.x.value == "50%"}}…{{else}}…{{/if}}`; literals in conditions are exempt from the figure rule (they guard prose, they are not stated)                                      |
| `COMPANY_INTROS[id] ?? default`, `COMPANY_FOLLOW_UPS`                               | `byId` / `default` fields                                                                                                                                                               |
| `PRINCIPLES_IN_PRACTICE[title] ?? ''`                                               | `strings.inPractice` + `{{strings.inPractice[.title]}}`; a missing key is a check error (stricter than `?? ''`, and the equivalence test shows today's record has every key)            |
| `technology(evidence)` sources, the undocumented-stack fallback                     | core policy in the compiler (same algorithm); the copy declares `fallbackSkillGroups`                                                                                                   |
| `slowDown(followUps)` empty-list fallback                                           | core policy; copy writes the default follow-ups                                                                                                                                         |
| `languages(question)` finding the asked language                                    | core binds `asked` (the language named in the question, same regex); copy branches on it                                                                                                |
| `project(id)`: "next live product"                                                  | `{{#with others \| where live \| first}}`                                                                                                                                               |

The compiler (`compileLocaleCopy`) produces the existing `AnswerSet` (`vocabulary`, `topics(kit)`,
`answers(kit)`), binding parameters per answer kind exactly as `answer-set.ts` declares them. It parses
templates once per locale; rendering at request time is a tree walk over prepared nodes (no parsing).

### 5.4 Validation of copy (FR-22, AC-22.1, FR-23, AC-23.1)

1. Parse every template (syntax errors with position).
2. Static resolution: field names against the zod shape of the localized record plus derived facts and
   parameter types; ids (`role.<id>`, `metric.<id>`, `project.<id>`, `byId` keys) against the record's
   actual ids. Paths in untaken branches are checked too.
3. Figures: no literal text segment contains a record figure (`recordFigures`: metric values and the years
   of the record's dates — the same rule `findFigureLiterals` enforces on TS today).
4. Exhaustive render: every answer × every parameter value (each role, each project, each technology alone
   and the documented/undocumented pair, each language plus none, `ctaShown` true/false, `slowDown` with and
   without follow-ups), every topic.
5. FR-23 needs no mechanism: an answer the copy omits is absent from `Answers`; the router already offers only
   what exists. A test removes one intent from the example's copy and asserts the fast path does not answer
   it (AC-23.1).

### 5.5 Conversion and equivalence in CI (AC-21.1, AC-21.2)

- D2 converts by hand, file by file, with the transcript test as the oracle: `src/testing/answer-transcript.ts`
  enumerates the inputs of §5.4 step 4 for an `AnswerSet` + record and returns a JSON transcript of every
  `AssistantResponse` and every `TopicCopy`.
- `src/profile/copy-equivalence.test.ts` (owner, deleted in D8) and
  `src/testing/fixture-profile/copy-equivalence.test.ts` (example, deleted in D4a with the TS fixture)
  assert `transcript(tsCopy) toEqual transcript(compiled templates)` per locale. Deep equality on the
  response objects is byte equality of every string.

---

## 6. Baseline and comparison (D0; FR-29, FR-30, D10, NFR-10)

A black-box tool, so it can capture a commit that predates it.

- **Enumerate** (`scripts/baseline/enumerate.mts`, copied temporarily into the checkout being captured and
  run there with `tsx`, never committed there): writes `inputs.json` — page paths per locale (from the site
  content), metadata routes (sitemap, robots, icons, share images), every topic and follow-up question and
  every intent/entity probe **that the router sends to the fast path**, retrieval probes, asset URLs.
  Captured once from the pre-change commit; the compare reuses the same inputs, which is what "same inputs,
  same outputs" means.
- **Capture** (`capture.mts --target <url>`): with the server started without `OPENAI_API_KEY`:
  - pages via Playwright: normalized DOM (removes non-JSON-LD `<script>`, `link[rel=preload|modulepreload|
stylesheet]`; rewrites `/_next/static/<hash>/…`, `?dpl=…`, `__variable_<hash>`/`__className_<hash>`),
    `<head>` metadata, computed `--color-*`/`--font-*` tokens, full-page screenshots at 1280×800 and
    390×844, light and dark;
  - metadata routes and assets: bytes, `content-type`, hashes; share image pixels;
  - fast-path answers: `POST /api/chat` per input, the final structured response (parts, follow-ups,
    sources, related, grounded), timings dropped; requests paced at ≤ 1 per 15 s against production (the
    40-per-10-minutes limiter), unpaced locally; resumable;
  - retrieval: top-k ids and scores for each probe against the materialized index (offline);
  - `pnpm eval:assistant --runs 1` (gpt-4o-mini for assistant and judge, per the owner's standing rule),
    saved case by case.
- **Store**: `PROFILE_HOME/baseline/<commit>/` with `manifest.json` (commit, date, tool version). Never in
  git; never run with the owner profile in CI.
- **Compare** (`compare.mts --baseline <dir> --target <url>`): reports every difference by input and path
  (pixel counts for screenshots, expected 0). Exit 0 only on zero differences. Every normalization is listed
  in `normalize.ts` with its reason; anything not listed is a difference (NFR-10). Eval: a case that passed in
  the baseline and fails now is re-run with `--only <id> --runs 3`; it counts as a regression only if it
  fails the majority.

Used at D0 (capture from `main` before the first POR-88 merge, AC-29.1), D4a (local build from
`profiles/owner`, then production), D6 (local build from Neon), D7 (production), D9 (production).

---

## 7. Security and secrets (NFR-5, FR-2, D9, AC-2.1)

### 7.1 Roles (created by `pnpm profile init` with a one-time `PROFILE_ADMIN_DATABASE_URL`)

```sql
create role profile_owner  login password :'owner_password';
create role profile_reader login password :'reader_password' connection limit 5;
alter role profile_reader set default_transaction_read_only = on;
alter role profile_reader set statement_timeout = '15s';
grant connect on database :db to profile_owner, profile_reader;
create schema profile authorization profile_owner;
grant usage on schema profile to profile_reader;
alter default privileges for role profile_owner in schema profile grant select on tables to profile_reader;
revoke create on schema public from public;
```

Roles created by SQL are not members of `neon_superuser` on Neon, which is what we want. The admin URL is
used once and is not stored by the tool. AC-2.1 is an integration test: the reader's `insert`, `update`,
`delete` and `select profile.revise(...)` fail with `permission denied` / `read-only transaction`.

### 7.2 Where each credential lives

| Variable                                              | Role               | Where                                                                                          |
| ----------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `PROFILE_DATABASE_URL`                                | reader             | Vercel Production + Preview (Sensitive); GitHub secret for the privacy job; owner `.env.local` |
| `PROFILE_OWNER_DATABASE_URL`                          | owner              | owner `.env.local` only                                                                        |
| `PROFILE_ADMIN_DATABASE_URL`                          | Neon default owner | used once by `init`, then unset                                                                |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Vercel             | owner `.env.local` only; token scoped to the team, with an expiry                              |
| `PROFILE_SOURCE`, `PROFILE_BUNDLE_DIR`                | —                  | not secret; transitional `PROFILE_BUNDLE_DIR=profiles/owner` on Vercel during D4a–D7           |

None is `NEXT_PUBLIC_*`; `src/env.ts` does not read any of them (only `scripts/` does), so they cannot reach
a bundle. The CLI loads `.env.local` with `process.loadEnvFile` when present. Rotation (documented, no code):
`alter role profile_reader password …` (or Neon console), update Vercel and the GitHub secret, publish.

### 7.3 Data exposure during the migration

CI builds and tests only the example from D4a on (NFR-3). Owner data committed during D1–D7 (the
`profiles/owner/` bundle, the converted copy) is already public today and is purged with the rest in D9
(D21). Vercel build logs are private; check errors may quote values there, never in GitHub logs.

---

## 8. Publish (FR-18, AC-18.1, D1)

`scripts/profile/vercel/deployments.ts` wraps `fetch` with `AbortSignal.timeout(15_000)` per call:

1. `GET /v9/projects/{VERCEL_PROJECT_ID}?teamId=…` → `name`, `link.repoId`, production branch.
2. `git ls-remote origin refs/heads/main` → `sha` (what "current main" means, pinned).
3. `POST /v13/deployments?forceNew=1&teamId=…` with
   `{ name, project, target: 'production', gitSource: { type: 'github', repoId, ref: 'main', sha } }`.
   Not retried on timeout (ambiguous — it may have started); retried up to 3 times only on 429/503 honouring
   `Retry-After`, or on a connection error before the request was sent.
4. Prints `https://<url>`, the `inspectorUrl`, the DB head revision it will build from, and with `--wait`
   polls `GET /v13/deployments/{id}` every 5 s for up to 15 min, exiting non-zero on `ERROR`/`CANCELED`.

`/api/health` gains `profile: { source, revision, digest }` from the manifest (passed in by the composition
root), so cutover verification can see which revision is live without reading the DB.

---

## 9. ADRs (FR-28)

| ADR              | Title                                                    | Status / effect                                                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0011             | The profile lives in a database read only at build       | New. B1, B2, B8: materialize step, content-addressed revisions, selection rule, no runtime reads. **Supersedes 0004** (the index is still built offline and never at build or request time; it is no longer committed — it is a document of the profile). 0004's status line becomes "Superseded by 0011". |
| 0012             | Answers are templates over the record                    | New. B6: closed language, static checks, structure in core / words in data. Refines 0002 (the fast path's answers are now data; the two paths are unchanged).                                                                                                                                              |
| 0013             | The repository holds no owner data, and a scan proves it | New. Privacy boundary, the scan's kinds and allowances (D12), history rewrite done once with its residual risks.                                                                                                                                                                                           |
| 0002, 0003       | —                                                        | Text genericised in D8 (D15); decisions unchanged, so edited in place as a privacy redaction, noted in the ADR README.                                                                                                                                                                                     |
| 0001, 0008, 0009 | —                                                        | Hold as written: the engine is plain TS; `materialize` runs before Turbopack; assets stay same-origin under `'self'`.                                                                                                                                                                                      |

---

## 10. Privacy scan (D8; FR-33–FR-36, FR-41, NFR-1, AC-25.1, AC-33.1, AC-35.1, AC-36.1)

### 10.1 Terms (`scripts/privacy/terms.ts`, from `src/profile/identifying-terms.ts`)

| Kind                           | From                                                                                                            | Matcher                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `identity`                     | name, first/last name, email, LinkedIn/GitHub URLs and handles, site host, User-Agent product                   | case-sensitive whole word (today's `matcher`)                  |
| `company`, `product`, `school` | employers + aliases, products, schools (minus `nonIdentifyingTerms`)                                            | case-sensitive whole word                                      |
| `vocabulary`                   | `ownerWords` (vocabulary words, role/project ids)                                                               | any case, identifier-aware (today's `wordPattern`)             |
| `figure`                       | `recordFigures`                                                                                                 | in string literals of TS/JS sources and in YAML/MD/JSON values |
| `contact`, `phrase`            | `privacy.yaml` (phone, address, chosen phrases)                                                                 | whole phrase, whitespace-normalized                            |
| `prose`                        | 10-word shingles of the record's long texts and the notes, minus shingles that also occur in the example bundle | rolling hash over normalized words                             |
| `asset`                        | git blob ids (`git hash-object`) of every stored asset                                                          | history mode: any reachable blob with that id                  |

Initials and terms under 4 characters are not matched (noise), except as parts of the identity URLs.

### 10.2 Modes and output

- **Tree**: every tracked or untracked-not-ignored file (`git ls-files -co --exclude-standard`); text files
  only; `profiles/example/**` is scanned for owner terms like everything else.
- **History** (`--history <clone>`): `git rev-list --objects --all` (paths and blobs), blobs streamed through
  `git cat-file --batch`, commit messages, tag messages, notes refs. Reports `blob <id> <path>:<line>`,
  `commit <id> message`, `path <id>` (the path itself matches).
- **Allowances** (`scripts/privacy/allowances.ts`, committed): by file and kind/field, never by term — e.g.
  `README.md` may contain `identity:siteHost` (the live example deployment link) and `identity:githubHandle`
  inside repository URLs (D12, NG9). Each allowance has a reason.
- **Output**: `path:line:col kind=<kind> term#<n>`; the line content is never printed. `--reveal` maps
  `term#n` to the term and refuses when `CI` is set. Before any output in GitHub Actions the process emits
  `::add-mask::<term>` for each term ≥ 4 characters, so even an accidental print is masked. Exit 1 on any
  match.
- **CI job `privacy`**: runs on `push` to `main` and on PRs whose head repo is this repo; reads terms from the
  DB with the reader secret. On `push` to `main` a missing secret **fails** the job (main is always
  scanned); on a fork PR the job is skipped with a notice (UC-4 3b). Added to the `ci` aggregator's `needs`.
- **PR/issue report** (FR-41, `scripts/purge/pr-report.mts`): `gh api` over PR titles, bodies, review
  comments and issue texts, printing numbers and kinds only.

---

## 11. History rewrite runbook (D9; FR-37–FR-41, D11, D12, D13, NFR-8, AC-34.1, AC-37.1–AC-40.1)

Preconditions (each recorded in `resume.md`): D8 merged and production verified; `gh pr list --state open`
empty; remote has only `main`; every local worktree and agent clone removed; a fresh
`pnpm profile export` hash-verified; `git clone --mirror` of the remote archived (`tar` + sha256) in
`PROFILE_HOME/purge/` (NFR-8, AC-NFR-8.1). Branch protection/rulesets on `main` and tags noted for re-enable.

1. **Inputs** (in `PROFILE_HOME/purge/`, never in git): `paths.txt` — every owner path in history (from
   `privacy:scan --history --list-paths`, plus the known data paths: `src/profile/{knowledge,copy,
evaluation,sites,generated}/`, `src/profile/{identity,brand,locales,global-error-copy,retrieval-probes}.ts`,
   the old `src/core/knowledge/data/`, `src/infrastructure/retrieval/knowledge-index.json`, `public/` owner
   files, `profiles/owner/`, `fidelity/reference/` screenshots, `docs/plan/i18n-whitelabel/`,
   `docs/plan/profile-database/{prd,design,test-plan}.md`, `index.html`); `blob-ids.txt` (asset blob ids);
   `expressions.txt` (`regex:\bTerm\b==>Neutral` per term, longest first; neutral tokens are generic words);
   `mailmap` (every historical author/committer email → the GitHub noreply address, names kept).
2. **Rewrite** in a fresh clone:
   `git filter-repo --sensitive-data-removal --invert-paths --paths-from-file paths.txt
--strip-blobs-with-ids blob-ids.txt --replace-text expressions.txt --replace-message expressions.txt
--mailmap mailmap --prune-empty never --prune-degenerate never`.
   The two `never` flags keep commits that only touched removed paths, so `main`'s commit count is unchanged
   (AC-37.1).
3. **Verify before pushing**: history scan = 0 (AC-34.1); `git diff <old main> <new main>` is **empty** (D8
   left HEAD owner-free, so the rewrite must not change the tip's tree); commit counts per ref equal; every
   author/committer email is the noreply address, names unchanged; `pnpm install && pnpm verify && pnpm build`
   on the new tip; `grep -c '^refs/pull/.*/head$' .git/filter-repo/changed-refs` recorded.
4. **Notes refs**: for each `refs/notes/semantic-release-*`, copy the note's content from the old commit to
   its rewritten commit (`.git/filter-repo/commit-map`), with `scripts/purge/notes-refs.mts`.
5. **Push**: lift protection, `git push --force --mirror origin` (`refs/pull/*` rejections are expected),
   re-apply protection, confirm `git ls-remote` shows only rewritten ids for heads, tags and notes.
6. **Rename** (D13): `gh repo rename <neutral-name>`; `package.json` `name` already changed in D8; update
   remotes. Vercel tracks the repository by id, so the Git connection survives a rename — verify it in the
   project's Git settings, and reconnect (project-level env vars and domains are unaffected) if it shows the
   old name.
7. **Releases** (FR-38): each tag already points at its rewritten commit; regenerate every release body with
   `@semantic-release/release-notes-generator`'s `generateNotes` over the rewritten range between consecutive
   tags (`scripts/purge/release-notes.mts`), `gh release edit <tag> --notes-file`. The next merge to `main`
   must publish the next version (AC-38.1).
8. **GitHub-side residue**: delete Actions caches (`gh cache delete --all`), artifacts and old workflow runs
   (Playwright and Lighthouse reports and logs rendered owner pages).
9. **GitHub Support** (FR-40): owner/repo, the number of affected PRs, the "first changed commits" from
   filter-repo's output; ask to dereference cached `refs/pull/*`, remove cached views and run GC. Track the
   ticket in `resume.md`. Note for the owner: GitHub states that **diff views of closed PRs disappear** after
   such a rewrite; titles, bodies and comments remain (D11).
10. **Re-verify**: `pnpm profile publish --wait`, baseline compare against production = 0, `/api/health`,
    a push to `main` deploys (AC-39.1), re-clone locally.

Rollback until step 9: force-push the archived mirror (`git push --mirror` from the backup) — GitHub
Support has not purged anything yet.

---

## 12. Change sequence per deliverable

Files listed are the ones each deliverable **owns**; two deliverables in the same set never own the same
file. Shared files are called out with their merge order.

**D0 — Baseline tool and capture · Deps: POR-87, POR-66 · S0 · Owner**

- Files: `scripts/baseline/**`, `package.json` (scripts `baseline:*`; **adds `yaml`, `pg`, `@types/pg`
  exactly pinned** so S1/S2 never fight over the lockfile), `pnpm-lock.yaml`.
- Ops: capture from the `main` commit preceding the first POR-88 merge, plus the eval run; record commit and
  location in `resume.md`.

**D1 — Bundle codec, example and owner bundles, checks, selection · Deps: D0 · S1 (∥ D2)**

- Files: `scripts/profile.mts`, `scripts/profile/{bundle,workspace,checks,materialize.ts,select-source.ts,
home.ts}` (checks except copy/overrides/graph), `scripts/example/render-example-assets.mts`,
  `profiles/README.md`, `profiles/example/**` and `profiles/owner/**` **except `copy/**`**,
  `src/profile/schema.ts` (adds `profileDataSchema`; `copy` typed as raw per-locale documents),
  `src/profile/evaluation.ts` (types moved; `src/profile/evaluation/cases.ts` imports them),
  `src/profile/identifying-terms.ts`, `.prettierignore` (bundle generated files).
- Not yet: the app keeps reading the TS profile. `materialize --out <dir>` is tested into temp dirs.
- Tests: decoded owner and example bundles deep-equal today's TS record/identity/brand/allow-list/evaluation;
  `selectSource` table; directory rules and limits; `prepare`-style `--if-absent --example`.

**D2 — Template language, compiler, converted copy · Deps: D0 · S1 (∥ D1)**

- Files: `src/core/assistant/copy/**`, `src/core/knowledge/figures.ts` (+ `src/testing/whitelabel.ts` import),
  `src/testing/answer-transcript.ts`, `src/profile/copy-equivalence.test.ts`,
  `src/testing/fixture-profile/copy-equivalence.test.ts`, `profiles/example/copy/**`, `profiles/owner/copy/**`.
- Interface fixed for D1 (§5.1): the copy documents' paths and the `compileLocaleCopy(copyDocuments, options)
→ LocaleCopy` signature; D1 passes the raw documents through unchanged.
- May split by answer group (boundaries, career, expertise, topics + vocabulary + ui/site/about) behind one
  engine PR; each group PR adds its documents and widens the equivalence test.

**D3 — Neon store and owner commands · Deps: D1 · S2 (∥ D4a)**

- Files: `scripts/profile/store/**` (adapter, connect, migrations, roles SQL), `scripts/profile/commands/
{init,migrate,export,import,diff,revisions,restore}.ts`, `scripts/profile/backups.ts`,
  `docs/profile/database.md`, `.github/workflows/ci.yml` (new `store` job: `postgres:17` service container,
  `pnpm test:store`), `package.json` (script `test:store`), `vitest.config.mts` (a `store` project run only by
  `test:store`, which fails without its URL — never skipped).
- Shared with D4a: `package.json` scripts and `ci.yml` (different hunks). **Merge D3 first**; D4a rebases.

**D4a — The app reads the materialized profile · Deps: D1, D2 · S2 (∥ D3)**

- Files: `src/profile/{index,publication,fonts,global-error-copy}.ts`, `src/profile/locales.ts` (deleted; the
  owner's copy of it is a one-line array also present in `profiles/owner/bundle.yaml`),
  `src/site/brand-css.ts` (face mapping), `src/testing/fixture-profile/**` (loads the example's
  materialization; same exported names; TS fixture and `fixture-index.ts` removed), `scripts/profile/checks/
{copy,overrides,suggestion-graph}.ts`, `next.config.ts`, `vercel.json`, `.gitignore`
  (`/src/profile/generated/`, `/src/testing/fixture-profile/generated/`, `/public/`), the committed
  `src/profile/generated/*` and `src/testing/fixture-profile/generated/*` removed (their bytes live in
  `profiles/owner|example/generated/`), `package.json` (`prepare`, `dev`, `build`, remove `test:fork`,
  `brand:css`, `fixture:index`), `vitest.config.mts` (drop the fork alias; add `globalSetup`),
  `.github/workflows/ci.yml` (drop `test:fork` from the matrix), `.dependency-cruiser.cjs`
  (`no-runtime-profile-store`; `global-error-reads-only-fonts` widened to `global-error-copy` reading its
  JSON), `src/architecture/**` (fixtures and whitelabel test pointed at the selected profile),
  `src/profile/*.test.ts` and `src/profile/**/answers.test.ts`/`routing.test.ts` (deleted: they tested the TS
  assembly that no longer ships; their protections are the checks of §4.2), `scripts/{build-knowledge-index,
build-retrieval-probes,build-knowledge-notes,ingest-sites,evaluate-assistant}.mts` (workspace I/O, bundle
  sources only), `e2e/bundle.spec.ts` (no store reference in server output).
- The TS owner record and copy modules stay (unimported except by `copy-equivalence.test.ts`) until D8.
- Ops before merge (owner): set `PROFILE_BUNDLE_DIR=profiles/owner` on Vercel Production and Preview.
  After merge: baseline compare locally (from `profiles/owner`) and against production = 0.

**D4b — Database source, write-back, publish · Deps: D3, D4a · S3**

- Files: `scripts/profile/workspace/database.ts` (selection of the store in `materialize` and the writing
  scripts), `scripts/profile/commands/{publish,status}.ts`, `scripts/profile/vercel/**`,
  `src/http/health-handler.ts` + `src/composition-root.ts` (profile provenance in health), `.env.example`
  (new variables, no values).

**D5 — Template docs · Deps: D4b · S4 (∥ D6)**

- Files: `docs/profile/README.md`, `docs/profile/database.md` (completed), `README.md` (template README,
  absorbs POR-70), `CONTRIBUTING.md`, `docs/adr/0011-…`, `0012-…`, `0013-…`, `docs/adr/README.md`,
  `docs/adr/0004-…` (status line).

**D6 — Owner migration · Deps: D4b · S4 · Owner (no code PR)**

- `pnpm profile init` on the owner's Neon project → copy `profiles/owner` to `PROFILE_HOME/bundles/owner` →
  `import` → `export` + byte-compare (FR-8) → local build with `PROFILE_DATABASE_URL` → baseline compare = 0
  → owner confirms holding the export (AC-31.1).

**D7 — Production cutover · Deps: D6 · S5 · Owner (no code PR)**

- Vercel Production + Preview: add `PROFILE_DATABASE_URL` (reader, Sensitive), remove `PROFILE_BUNDLE_DIR`;
  `pnpm profile publish --wait`; baseline compare against production = 0; `/api/health` shows the commit and
  the DB revision; eval pass rates ≥ baseline case by case; second publish succeeds; fresh export.

**D8 — Purge the working tree, privacy scan · Deps: D5, D7 · S6**

- Files: delete `profiles/owner/**`, every owner TS module under `src/profile/**`,
  `src/profile/copy-equivalence.test.ts`, `src/profile/README.md`, tracked `public/*`,
  `docs/plan/i18n-whitelabel/**`, this plan's documents except `resume.md`; genericise ADRs 0002/0003,
  `.env.example`, owner ids in adapter tests; `package.json` `name` (D13); `scripts/privacy/**`,
  `scripts/purge/**`; `.github/workflows/ci.yml` (`privacy` job); `lefthook.yml` (optional pre-push
  `privacy:scan` when a reader URL is present).
- Ops before merge: fresh export (NFR-8); after merge: tree scan = 0 (AC-33.1).

**D9 — History rewrite and rename · Deps: D8, no open PR or branch · S7 · Owner**

- §11. A small PR after the rename only if links need it (README badge).

### Parallel sets (revised)

| Set | Deliverables (implement in parallel, merge in series) |
| --- | ----------------------------------------------------- |
| S0  | D0                                                    |
| S1  | D1, D2                                                |
| S2  | D3, D4a (merge D3 first)                              |
| S3  | D4b                                                   |
| S4  | D5, D6                                                |
| S5  | D7                                                    |
| S6  | D8                                                    |
| S7  | D9                                                    |

Critical path: D0 → {D1, D2} → D4a → D4b → D6 → D7 → D8 → D9 (D3 runs beside D4a).

---

## 13. Testing hooks this design creates (for the test strategist)

| Layer                                          | New suites                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                                           | template parser/renderer/checker (syntax, strictness, trimming, filters per locale, prototype paths rejected); compiler binding per answer kind; AC-23.1                                                                                                   |
| Equivalence                                    | `answer-transcript` owner (D2→D8) and example (D2→D4a)                                                                                                                                                                                                     |
| Tooling (node)                                 | `selectSource` table (AC-13.1); bundle directory rules; decode errors with positions; each check with a planted fault (AC-3.1, AC-22.1); manifest/digest; in-memory workspace for import/export/diff (AC-11.1)                                             |
| Store (`test:store`, real Postgres 17 service) | migrations + checksums; round trip (AC-5.1/8.1); invalid bundle changes nothing (AC-6.1); kill mid-write (AC-6.2); backup before first write (AC-7.1); concurrent-import conflict; reader refused writes (AC-2.1); unreachable host fails < 60 s (AC-13.2) |
| Architecture                                   | `no-runtime-profile-store` fixture; client-reachability still excludes the profile JSON from the client except `global-error.json`                                                                                                                         |
| E2E                                            | existing journeys on the example (FR-25); `bundle.spec.ts` server-output scan; asset URLs answer with expected bytes and content type (AC-14.1)                                                                                                            |
| Privacy                                        | planted term in a test file → reported by kind, term absent from output (AC-35.1); `--reveal` refused under `CI`; history mode on a synthetic repo                                                                                                         |
| Baseline                                       | one-answer difference reported exactly; identical build reports zero (AC-30.1)                                                                                                                                                                             |

---

## 14. PRD review notes

Settled here without changing the PRD's intent:

1. **AC-24.1 and the app-level half of AC-13.1 land in D4a, not D1.** D1 delivers the codec, the bundles and a
   tested selection function, but switching the app needs the compiled copy (D2). Splitting D4 into D4a
   (bundle sources, app switch) and D4b (DB source, publish) lets D3 run beside D4a and shortens the critical
   path.
2. **Transition source.** Between D4a and D7 production builds from `profiles/owner/` in the repository
   (B9). This is owner data committed during D1–D7, allowed by D21 and purged by D9.
3. **"Commit count unchanged" (AC-37.1)** holds only with `--prune-empty never --prune-degenerate never`;
   filter-repo prunes by default.
4. **Closed-PR diffs disappear** after a rewrite (GitHub's documented side effect). D11 keeps PR history;
   the owner should know the diffs will not render.
5. **D12 vs the scan.** The README's live-site link and repository URLs contain identity terms; the scan
   allows them by file and kind (§10.2), so FR-34 and D12 both hold.
6. **This plan's own documents name the owner** (URLs, file names). D8 removes them from the tree with
   `docs/plan/i18n-whitelabel/**`, keeping an owner-term-free `resume.md`; D9 removes them from history.
7. **GitHub Actions residue** (logs, Playwright/Lighthouse artifacts, caches) holds rendered owner pages; D9
   deletes it (§11 step 8). Not in the PRD; needed for G1's spirit.
8. **Neon Free plan today:** 1 GB storage per project, 6-hour instant-restore window, 100 CU-hours per month,
   scale to zero after 5 minutes. D18's US$0 target holds; the restore window is recorded in the docs.
9. **Evaluation cost.** Baseline and cutover runs use gpt-4o-mini for assistant and judge and `--runs 1`,
   with majority re-runs only for flipped cases (§6).
10. **Do not install the Vercel–Neon marketplace integration**; it injects owner-role credentials into every
    environment (B11).

---

## 15. Risks and rollback

| #   | Risk                                                                                             | I×P | Mitigation                                                                                                                                  | Rollback                                                     |
| --- | ------------------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| R1  | Templates drift from today's prose (whitespace, articles, plurals, dates)                        | 4×4 | Transcript equivalence per locale in CI until D8; baseline at D4a/D6/D7; strict renderer; CR rejected                                       | Revert the group's PR; TS copy is still in the tree until D8 |
| R2  | Production ships the example                                                                     | 5×2 | Selection rule + `next.config` guard + baseline at cutover; `/api/health` shows the source                                                  | Publish again with the right env                             |
| R3  | Data loss: DB the only copy and lost, or a bad import published                                  | 5×2 | Content-addressed immutable revisions; automatic verified backup before every write; 20 revisions; 6 h PITR; local exports; NFR-8 gates     | `restore <rev>`, PITR, or import the backup; publish         |
| R4  | Neon unreachable or slow at build                                                                | 2×3 | Timeouts, 3 bounded retries, < 60 s; the live deployment is untouched                                                                       | Re-run the deploy                                            |
| R5  | Template language grows into a programming language                                              | 3×3 | Closed filter list; ADR 0012; a new filter needs a core change and a test; logic goes to core policy, not to data                           | —                                                            |
| R6  | Reader credential leaks                                                                          | 3×2 | Read-only role, connection limit, Sensitive env, never logged; data it reads is what the site already publishes                             | Rotate (no code)                                             |
| R7  | Rewrite incomplete (PR refs, notes, old clones, forks)                                           | 4×4 | Fresh-clone rewrite of all refs; HEAD-tree identity; history scan on a fresh mirror; notes re-created; Support ticket; local clones deleted | Force-push the archived mirror before Support purges         |
| R8  | Force-push breaks releases, semantic-release or Vercel                                           | 4×3 | Notes copied by commit map; releases re-noted; repoId-based publish; next release and a push deploy verified                                | Mirror restore                                               |
| R9  | Generated files missing confuse local tools (`tsc`, depcruise)                                   | 2×4 | `prepare` materializes the example; Vitest `globalSetup` and `materialize` messages say what to run                                         | `pnpm profile materialize`                                   |
| R10 | Owner materializes his profile locally and something commits it                                  | 4×2 | Generated paths and `public/` ignored; tools refuse to write bundles/backups inside the repo; tree scan in CI and optional pre-push         | D9-style purge of the offending commit before merge          |
| R11 | Baseline noise across code changes (chunk names, font class hashes) hides or invents differences | 3×3 | DOM-level comparison with an explicit, justified normalization list; pixels and computed tokens as independent evidence                     | Tighten normalization; never widen without a reason          |

---

## 16. Traceability

| Requirement          | Design §      | Deliverable |
| -------------------- | ------------- | ----------- |
| FR-1, FR-2, FR-4     | 3.2, 7.1      | D3          |
| FR-3, D17            | 4.2           | D1, D2, D4a |
| FR-5–FR-9, FR-11     | 3.1, 3.3, 3.5 | D3          |
| FR-10                | 3.5           | D3, D5      |
| FR-12, NFR-2, NFR-9  | 2.1, 4.1, 4.5 | D4a         |
| FR-13, D8            | 4.3           | D1, D4a     |
| FR-14, D4            | 3.1, 4.1      | D4a         |
| FR-15–FR-17          | 4.3           | D4a, D4b    |
| FR-18                | 8             | D4b         |
| FR-19, D19           | 4.4           | D4a         |
| FR-20–FR-23, D20     | 5             | D2, D4a     |
| FR-24, FR-25, D7     | 3.6, 4.1      | D1, D4a     |
| FR-26–FR-28          | 9             | D5          |
| FR-29, FR-30, D10    | 6             | D0          |
| FR-31, FR-32         | 12 (D6, D7)   | D6, D7      |
| FR-33–FR-36, FR-41   | 10            | D8          |
| FR-37–FR-40, D11–D13 | 11            | D9          |
| NFR-1                | 7.3, 10       | D8, D9      |
| NFR-3                | 4.1           | D4a         |
| NFR-4                | 3.4, 4.1      | D4a, D4b    |
| NFR-5, NFR-6         | 3.4, 7        | D3, D4b     |
| NFR-7                | 3.6, 14.8     | all         |
| NFR-8                | 11, 12        | D7–D9       |
| NFR-10               | 6             | D0, D7      |

---

Sources consulted: [Neon plans](https://neon.com/docs/introduction/plans) ·
[Neon database access](https://neon.com/docs/manage/database-access) ·
[Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) ·
[Vercel: create a deployment](https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment) ·
[Vercel deploy hooks](https://vercel.com/docs/deploy-hooks) and
[community reports of hooks not deploying](https://community.vercel.com/t/vercel-deploy-hook-creates-job-but-deployment-never-appears-or-executes/31893) ·
[GitHub: removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) ·
[git-filter-repo manual](https://raw.githubusercontent.com/newren/git-filter-repo/main/Documentation/git-filter-repo.txt).
