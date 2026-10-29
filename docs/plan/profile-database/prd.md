# PRD — Profile in a database, privacy cleanup of the repository (`profile-database`)

Status: draft for approval · Ticket: POR-88 · Author: feature planner · Date: 2026-10-28 · Rev. 1
(based on `main` accd3cc; starts after POR-87 and POR-66 merge)

## 1. Overview

The portfolio (live at `https://marciomariani.dev`, deployed on Vercel from a **public** GitHub
repository) became whitelabel in `i18n-whitelabel`: everything about the owner lives in
`src/profile/**`, and a fictional fixture profile ("Ada Rivera") proves a fork works. But "lives in one
folder of a public repository" still means the owner's whole record — identity, contact, career,
long-form notes, answer prose, evaluation cases, the embedded retrieval index, the photo and a résumé
PDF carrying his phone number — is published in the repository and in its 297-commit history, along
with tests and plan documents that name him.

This initiative moves **all profile content into a Neon Postgres database** that the site and the
assistant read **at build time only**, and turns the repository into a **generic template** that ships
only the fictional example profile plus the documentation to create, populate, publish and back up a
profile database. Production keeps serving the owner's data with the same content and the same answers.
Once production is verified on the database, the owner's data is deleted from the working tree and
**purged from the git history** (rewritten and force-pushed; GitHub Support asked to purge cached
pull-request refs). It is for the owner (privacy of his personal data), for visitors (nothing changes),
and for a developer who forks the template (who gets a clean example and a documented path to their own
database). It is scheduled now because the whitelabel boundary already exists, so the data has a single
seam to move through.

## 2. Goals and non-goals

### Goals

- G1. After the purge, no file in the working tree and no object reachable from any branch, tag or notes
  ref of the repository contains the owner's profile data, checked by a scan over the full history.
- G2. The database is the single copy of the owner's profile; the site, the assistant and every profile
  script read it, and the owner can edit, publish, back up and restore it without a code change.
- G3. Production at `https://marciomariani.dev` serves the same pages and the same fast-path answers,
  byte-for-byte after normalisation, in every published locale, and the model path holds its evaluation
  pass rates.
- G4. Visitors are never affected by the database: no request reads it; a database outage only blocks
  deploys.
- G5. A fork, CI and local development build, test and run with the shipped example profile and no
  database credentials; a fork can follow the documentation to stand up its own database.
- G6. The owner's data is never lost during the migration: it is loaded, verified and exported to a
  private local copy before anything is deleted.

### Non-goals (explicitly out of scope)

- NG1. An admin UI, CMS, web editor or any write path reachable from the site. The owner edits through
  local files and a command, or SQL.
- NG2. Runtime reads of the database, on-demand revalidation, ISR or "edit goes live without a deploy".
  Publishing is "update the database, then redeploy" (D1).
- NG3. A private repository (or any git repository) holding the owner's data. The database is the only
  copy; backups are database restore points plus local exports the owner keeps outside git (D2).
- NG4. Several profiles served by one deployment, profile selection at request time, multi-tenancy.
- NG5. Changing any content, copy, design, route, locale, URL or behaviour. This is a move, not a
  rewrite: the baseline comparison (FR-30) is the definition of "unchanged".
- NG6. Generating the résumé PDF (POR-67 is dropped, D16). The current hand-made PDF moves as-is.
- NG7. Purging copies outside this repository: forks (there are none today), clones on other machines,
  search-engine or archive caches, Vercel's private deployment history. They are recorded as residual
  risk (§8 Risks).
- NG8. Rewriting pull-request titles, bodies, review comments or issue text on GitHub. PR history is kept
  (D11); FR-41 only reports which of them mention owner terms so the owner can decide by hand.
- NG9. Hiding that the repository belongs to the owner's GitHub account. The account, the author name on
  commits and the live-site link in the README stay (D12).
- NG10. Running `pnpm eval:assistant` in CI (unchanged: it stays local, now reading the database).
- NG11. Adding font faces the template does not already bundle (see D19).

## 3. Assumptions and decisions

| #   | Topic                        | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Source         |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| D1  | Publishing                   | The site and the assistant read the database **only at build time**. Publishing an edit is: update the database, then **one command** triggers a Vercel production redeploy. A database outage leaves visitors unaffected and only blocks deploys.                                                                                                                                                                                                                                                                                        | Owner (Q1)     |
| D2  | Source of truth              | **Neon Postgres is the single copy** of the owner's profile. No private repository. Backups are (a) Neon's point-in-time restore window and (b) a logical export ("profile bundle") the owner keeps privately, outside git; the import command writes one automatically before it changes anything.                                                                                                                                                                                                                                       | Owner (Q2)     |
| D3  | What moves                   | Everything about the profile: identity (name, initials, email, LinkedIn, GitHub, domain, User-Agent product), published locales, the record (`knowledge/**`), long-form notes (`knowledge-base.md` / `notes.json`), brand colours and font choice, all per-locale copy (`copy/**`: fast-path answers, topic pages, vocabulary, `ui`, `site`, `about`), `global-error-copy`, the site allow-list and snapshot, evaluation cases and calibration, retrieval probes, the retrieval index and probe embeddings, the résumé PDF and the photo. | Owner          |
| D4  | Binary assets and index      | The PDF, the photo, the retrieval index and the probe embeddings live in the database (or a store the database references, chosen by the architect) and are emitted into the build, so they are served from the site's own domain at the **same URLs** as today (`/marcio-alves-resume.pdf`, `/marcio-alves.jpg`). CSP stays `'self'`.                                                                                                                                                                                                    | Owner (Q2)     |
| D5  | Editors                      | Only the owner, through (a) exporting a profile bundle to local files kept out of git, editing them, and importing it back, or (b) SQL. No admin UI.                                                                                                                                                                                                                                                                                                                                                                                      | Owner (Q3)     |
| D6  | Profile bundle               | A **profile bundle** is the human-editable, file-based form of one whole profile: text content as plain text files (Markdown/JSON or equivalent), binaries as files. Export then import with no edit leaves the database unchanged (round trip). The shipped example profile is a bundle in the repository; the owner's bundles live only on his machine. The file layout is the architect's.                                                                                                                                             | Planner        |
| D7  | Example profile              | The fictional "Ada Rivera" fixture becomes the **one** shipped example: the profile CI, the tests, local development and a fork's first build use. It is written in `en` and `pt-BR`, with a neutral placeholder photo, an example résumé PDF and its own committed retrieval index. No term overlaps an owner term.                                                                                                                                                                                                                      | Owner (Q4)     |
| D8  | Profile selection at build   | With database credentials present the build reads the database. Without them it uses the example profile **only** outside a production deployment, or when the deployment opts in explicitly (a fork deploying the example on purpose). A production build (`VERCEL_ENV=production`) with no credentials and no opt-in, or with an unreachable database, **fails**; the previous deployment stays live. Production never silently shows the example profile.                                                                              | Planner, owner |
| D9  | Preview deployments          | Vercel preview builds read the owner's database with the same **read-only** credentials as production.                                                                                                                                                                                                                                                                                                                                                                                                                                    | Planner, owner |
| D10 | Equivalence                  | "Same content, same answers" means: before any change, a **baseline** is captured from the current build — every prerendered page and metadata output, every fast-path answer to every suggested question and intent probe, per published locale, plus the PDF/photo bytes and retrieval results for the probes. The baseline holds owner data, so it is kept **outside git** on the owner's machine. Cutover requires a zero-difference comparison; the model path requires `eval:assistant` pass rates no lower than the baseline run.  | Planner, owner |
| D11 | History purge                | Keep the repository. Rewrite history with `git filter-repo` (paths, text, commit messages, author email), force-push every branch, tag and `refs/notes/semantic-release-*` ref, re-point or recreate the GitHub releases on the rewritten tags, then ask **GitHub Support** to purge cached `refs/pull/*` and unreachable objects. PR history is kept. Residual risk: completeness depends on Support.                                                                                                                                    | Owner (Q5)     |
| D12 | Anonymity                    | No profile content in the repository. Keep the account, the author **name** on commits, the README's live-site link and the repo's homepage setting. Rewrite the author **email** on every commit to the owner's GitHub noreply address. Rename the repository and `package.json` `name` to a neutral name. The README becomes a template's README, citing `marciomariani.dev` as an example deployment.                                                                                                                                  | Owner (Q6)     |
| D13 | Neutral name                 | The new repository and package name contains no owner term and describes the template (proposal: `grounded-portfolio`); the owner may pick another before D9 runs. GitHub's redirect from the old name is accepted.                                                                                                                                                                                                                                                                                                                       | Planner        |
| D14 | Sequencing with other work   | POR-87 (PR #94) merges first. POR-88 starts after POR-66 merges, so Portuguese is moved once, already enabled. POR-88 absorbs POR-70's README/CONTRIBUTING work. POR-67 is dropped. No other branch or PR may be open when the history rewrite runs.                                                                                                                                                                                                                                                                                      | Owner (Q7)     |
| D15 | What leaves the repo         | Besides `src/profile/**` content: `public/marcio-alves-resume.pdf`, `public/marcio-alves.jpg`, the owner-specific tests (`src/profile/*.test.ts` and those beside the copy, knowledge, evaluation and generated files), `docs/plan/i18n-whitelabel/**`, the owner references in ADRs 0002/0003, `README.md`, `.env.example`, `package.json` `name`, and the owner ids in adapter tests (e.g. `"deel"` in `openai-language-model.test.ts`). The plan documents are kept by the owner in his local export, not in the database.             | Owner, planner |
| D16 | Résumé PDF                   | The current hand-made PDF moves into the database byte-for-byte; only the English résumé exists, at its current URL.                                                                                                                                                                                                                                                                                                                                                                                                                      | Owner (Q7)     |
| D17 | Profile checks without names | The owner's own record tests are deleted with the data. What they protected becomes **generic checks** that run on whatever profile is being built or imported: schema validation, translation integrity (every text written, same figures), site passages on the allow-list, retrieval index matching the corpus, suggestion graph closing. They run on import and at every build.                                                                                                                                                       | Planner        |
| D18 | Neon plan and cost           | The owner's data (a few MB, index ≈ 1.5 MB) fits Neon's free plan; the target is **US$0/month** added cost. The restore window available on the plan in use is recorded in the docs; the local export (D2) covers anything older.                                                                                                                                                                                                                                                                                                         | Planner        |
| D19 | Fonts                        | The brand's font choice is profile data. Faces are self-hosted and `next/font` needs literal options, so a profile picks from the faces the template bundles (today Inter, Inter Tight, Geist Mono); adding a new face is a template code change.                                                                                                                                                                                                                                                                                         | Planner (code) |
| D20 | Answer copy as data          | Fast-path answers, topic copy and router vocabulary, today TypeScript functions written over the record, become **data**: templates that name the record's facts through placeholders and render through a generic engine. The owner rewords an answer by editing text, never code. The template language is the architect's.                                                                                                                                                                                                             | Owner, planner |
| D21 | Delivery                     | One deliverable = one PR titled `POR-88: <resumo em português>` (sub-keyed per deliverable by the orchestrator), Portuguese non-technical body with test steps, merged on green CI per the repository's delivery model. Until D8 the owner's data may still be in the repository; anything added before then is purged by D9 with the rest.                                                                                                                                                                                               | Coordinator    |

## 4. Functional requirements

Priority: **M** = must, **S** = should. Every FR has acceptance criteria in §7.

### A. Profile store

- **FR-1 (M)** The owner's whole profile (D3) is stored in a Neon Postgres database; nothing in D3 needs
  a file in the repository to build the owner's site.
- **FR-2 (M)** The database has two access levels: a **read-only** credential used by builds (Vercel
  production and preview) and an **owner** credential that can write, used only on the owner's machine.
- **FR-3 (M)** Every profile read from the database is validated with the same rules as today's
  `validateProfile` plus the generic checks (D17) before anything is built from it; an invalid profile
  fails with the path of every problem.
- **FR-4 (M)** The database schema can be created from empty by one documented command, so a fork can
  stand up its own database.

### B. Profile bundles: edit, import, export, backup

- **FR-5 (M)** `export` writes the database's whole profile — text, binaries, index and embeddings — to
  a local directory as a profile bundle (D6).
- **FR-6 (M)** `import` validates a bundle (FR-3) and, only if it is valid, replaces the database's
  profile with it in one transaction; an invalid bundle changes nothing and names every problem.
- **FR-7 (M)** Before `import` changes anything it writes an export of the current database to a local
  backup location outside the repository, and reports where.
- **FR-8 (M)** Export followed by import with no edit leaves the database identical; import followed by
  export reproduces the bundle's content identically.
- **FR-9 (M)** Bundles, backups and any file holding owner data are written outside the repository by
  default, and the repository ignores the default locations, so they cannot be committed by accident.
- **FR-10 (M)** The docs state the backup policy: the restore window of the Neon plan in use, how to
  restore to a point in time, how to restore from a local export, and how often to take a manual export.
- **FR-11 (S)** A command reports what an import would change (added, changed, removed items per
  content type) without writing.

### C. Build and scripts read the store

- **FR-12 (M)** The production build prerenders every page from the profile read at build time; the
  assistant's API functions are deployed with the profile, index and embeddings of the same build. No
  request at runtime reads the database.
- **FR-13 (M)** Profile selection at build follows D8: database when credentials exist; the example
  profile without them outside production or with an explicit opt-in; otherwise the build fails with a
  message naming the missing setting.
- **FR-14 (M)** The PDF and the photo are served from the site's own origin at the URLs the profile
  names (production: `/marcio-alves-resume.pdf`, `/marcio-alves.jpg`), with the same bytes and content
  types as today.
- **FR-15 (M)** `pnpm rag:build` and `pnpm rag:probes` read the corpus and probes from the selected
  profile and write the index and embeddings back to it (database or example bundle); the index-matches-
  corpus check holds for both.
- **FR-16 (M)** `pnpm notes:build` and `pnpm sites:ingest` read their inputs from and write their
  outputs to the selected profile; the allow-list, robots and staleness rules are unchanged.
- **FR-17 (M)** `pnpm eval:assistant` reads its cases and calibration from the selected profile.
- **FR-18 (M)** One command triggers a production redeploy of the current `main` (the "publish"
  command), and reports the deployment it started.
- **FR-19 (M)** Brand tokens (colours, font choice) and the generated stylesheet tokens come from the
  selected profile at build; no owner brand file is committed.

### D. Answers and copy as data

- **FR-20 (M)** Every fast-path answer, every topic page's copy, every follow-up, the router vocabulary,
  the interface overrides (`ui`, `site`), the about page and the global-error copy are data in the
  profile, per locale (D20).
- **FR-21 (M)** Rendered from data, each answer and topic page is identical to what the current
  TypeScript copy produces for the same record, in every locale, for every intent, company, project and
  technology the record contains.
- **FR-22 (M)** Answer templates name facts (companies, periods, metrics, counts, dates) only through
  placeholders resolved from the record; a template that states a figure the record does not hold, or
  references a fact that does not exist, fails validation with its path.
- **FR-23 (M)** An answer or intent the profile's copy omits is not offered (as today: removing an owner
  intent's copy removes the answer, no core change).

### E. Example profile and template documentation

- **FR-24 (M)** The repository ships the example profile (D7) as a bundle; with no credentials,
  `pnpm dev`, `pnpm build`, `pnpm test` and `pnpm test:e2e` run against it.
- **FR-25 (M)** The test suites (unit, integration, e2e) pass against the example profile and read
  expected visible text from the selected profile, never from a literal.
- **FR-26 (M)** The documentation explains, in order: what a profile bundle contains (every content
  type and its rules), creating a Neon database and the two credentials, creating the schema, importing
  a bundle, building the index, publishing, editing, backing up and restoring, and the Vercel settings
  (env vars for production and preview, the redeploy command).
- **FR-27 (M)** The README is a template's README (absorbs POR-70): what the project is, live example
  deployment link, stack, how it is built, how to make it yours (link to the profile docs), with setup
  detail in `CONTRIBUTING.md`.
- **FR-28 (S)** ADRs record the build-time profile store (superseding ADR 0004's "committed index" for
  owner data) and the privacy boundary.

### F. Migration and cutover

- **FR-29 (M)** A baseline (D10) is captured from the build of `main` before any POR-88 change merges,
  stored outside the repository.
- **FR-30 (M)** A comparison command builds the site from a given profile source and compares it to the
  baseline: every page, metadata output (titles, canonical, hreflang, sitemap, JSON-LD, share image),
  fast-path answer per suggested question and intent probe per locale, PDF and photo bytes, and probe
  retrieval results. It reports every difference after normalising build ids and hashes.
- **FR-31 (M)** A one-time migration converts today's repository profile into an owner bundle (outside
  the repository), imports it into the owner's Neon database, and verifies it: round trip (FR-8), zero
  baseline differences (FR-30), and a local export the owner confirms he holds.
- **FR-32 (M)** Cutover switches production and preview to the database (read-only credentials), deploys,
  and verifies production: zero baseline differences against the deployed site, `/api/health` reports
  the deployed commit, `eval:assistant` pass rates no lower than the baseline run, the publish command
  redeploys successfully.

### G. Purge

- **FR-33 (M)** After cutover is verified, every file in D15 is removed from the working tree or
  rewritten to be owner-free, and `public/` holds no owner asset.
- **FR-34 (M)** A privacy scan, given a profile's terms (identity, contact handles, domain, employers,
  products, schools, metric values, phone number, distinctive phrases of the notes), finds none of them
  in the working tree, and — in history mode — in any blob, path, commit message, tag message or notes
  ref reachable from any ref.
- **FR-35 (M)** The privacy scan reads the owner's terms from the database or a local bundle, never from
  a committed file, and its output names file, line/commit and term **kind**, never the term itself, so
  it can run in public CI logs.
- **FR-36 (M)** CI runs the working-tree privacy scan against the owner's terms on pushes and PRs from
  this repository (read-only credential as a CI secret, unavailable to fork PRs); a match fails the run.
- **FR-37 (M)** History is rewritten (D11): owner paths removed from every commit, owner terms replaced in
  remaining blobs and commit/tag messages, author and committer emails rewritten to the noreply address
  (names kept), and every branch, tag and semantic-release notes ref force-pushed.
- **FR-38 (M)** Every GitHub release points at its rewritten tag with notes regenerated from rewritten
  history, and the next `semantic-release` run continues the version sequence.
- **FR-39 (M)** The repository and `package.json` are renamed to the neutral name (D13); Vercel's Git
  connection, the CI badge/links and the repo homepage still work after the rename.
- **FR-40 (M)** A GitHub Support request to purge cached `refs/pull/*` and unreachable objects is filed
  with the rewritten-commit map, and its status is tracked in `resume.md` until GitHub confirms.
- **FR-41 (S)** The purge report lists PR titles/bodies/comments and issue texts that contain owner terms
  (by number and kind only), for the owner to edit by hand if he chooses.

## 5. Non-functional requirements

- **NFR-1 Privacy.** After D9: zero matches for the history-mode privacy scan (FR-34) across every ref of
  the remote; after GitHub Support confirms, `refs/pull/*` resolves only to rewritten commits. No owner
  data appears in public CI logs, committed fixtures, error messages or test snapshots at any time after
  D8. Owner bundles, backups and the baseline never enter git (FR-9).
- **NFR-2 Availability.** No visitor request depends on the database (FR-12): with the database
  unreachable, every page, the fast path and the model path behave exactly as when it is reachable. A
  build that cannot read the database fails within 60 s of trying, naming the cause; the live deployment
  is untouched.
- **NFR-3 Build without credentials.** `pnpm build`, `pnpm verify` and the CI jobs `build`, `e2e`, `a11y`
  and `lhci` run with no database credential and no network access to Neon, using the example profile.
  The CI `build` job still receives no secrets.
- **NFR-4 Performance.** Lighthouse budgets in `lighthouserc.json` and the first-load JS budget hold
  unchanged on production; chat latency (time to first event) is unchanged because no request reads the
  database. Reading the profile adds at most 30 s to a production build.
- **NFR-5 Credential security.** The database credentials are server/build-only environment variables,
  never `NEXT_PUBLIC_*`, never in the client bundle, never logged, never in an error message; connections
  require TLS. The build and CI hold only the read-only credential; the write credential exists only on the
  owner's machine. Rotating either credential is a documented procedure that needs no code change.
- **NFR-6 Resilience.** Every database call made by the build and the scripts has a timeout and a bounded
  retry; an import is all-or-nothing (FR-6).
- **NFR-7 Cost.** Added recurring cost US$0/month on Neon's free plan (D18); builds and deployments still
  never call the embeddings API.
- **NFR-8 Data integrity.** No owner data is deleted from the repository until FR-31 and FR-32 have both
  passed and the owner holds a fresh local export (taken after cutover, before D8). The history rewrite
  runs only after a second export is taken and a bare mirror of the pre-rewrite repository is stored with
  it, outside git hosting.
- **NFR-9 Architecture.** `src/core` stays framework-free; the database adapter sits outside the core and
  the composition roots; dependency-cruiser rules pass, with a rule that no page or route module imports
  the database adapter (it is a build-time dependency only).
- **NFR-10 Truthfulness.** No content changes: every difference reported by FR-30 is a defect, not an
  edit, unless the owner accepts it in writing in the PR.

## 6. Use cases

### UC-1 Owner edits and publishes his profile

- Scope: profile store and its commands · Level: user-goal · Primary actor: owner
- Stakeholders: owner (change one answer or fact safely); visitors (see the updated site).
- Preconditions: owner credential on his machine; the database holds a valid profile.
- Success end: the site serves the edited content; a pre-import backup exists locally.
- Trigger: the owner wants to change a fact, a translation or an answer's wording.

Main success scenario:

1. Owner exports the profile to a local bundle.
2. Owner edits the text files of the bundle.
3. Owner asks for a preview of changes; System lists what would change per content type.
4. Owner imports the bundle; System writes a backup export, validates the bundle and replaces the
   profile in one transaction.
5. Owner rebuilds the retrieval index; System writes the new index to the database.
6. Owner runs the publish command; System starts a production redeploy and reports it.
7. System builds from the database and the edited content goes live.

Extensions:

- 4a. The bundle is invalid (a translation adds a figure, a template names a missing fact): System
  changes nothing and lists every problem by path.
- 5a. Owner skips the rebuild: the build fails because the index does not match the corpus.
- 6a. The database is unreachable at build: the deployment fails naming the cause; the previous one
  stays live.
- *a. Owner made a mistake already published: Owner imports the backup export (or restores a point in
  time) and publishes again.

### UC-2 Visitor gets the same answers

- Primary actor: visitor (recruiter, engineer) · Goal: learn about the owner.
- Main success scenario:
  1. Visitor opens any page in any published locale.
  2. System serves the prerendered page, identical to before the migration.
  3. Visitor asks a suggested question; System answers from the fast path with the same answer as before.
  4. Visitor asks a free-form question; System answers through the model with the same grounding.
  5. Visitor downloads the résumé at its usual URL.
- Extensions: *a. The database is down: nothing in 1–5 changes.

### UC-3 Fork sets up their own profile

- Primary actor: developer who forked the template · Goal: run their own portfolio.
- Main success scenario:
  1. Developer clones the fork and runs it; System serves the example profile with no setup.
  2. Developer creates a Neon database and the two credentials, following the docs.
  3. Developer creates the schema and imports a copy of the example bundle edited with their data.
  4. Developer builds their index and sets the read-only credential on Vercel.
  5. Developer deploys; System builds every page, answer, asset and metadata from their database.
- Extensions: 3a. Their bundle is invalid: System names every problem. 5a. They deploy to production
  without credentials: the build fails and names the setting, or serves the example if they opted in.

### UC-4 CI runs with the example profile

- Primary actor: CI (GitHub Actions) · Goal: gate a change without any owner data.
- Main success scenario:
  1. A push or PR runs the CI jobs with no database credential.
  2. System builds, tests and runs the browser checks against the example profile.
  3. On this repository's own pushes and PRs, the privacy job reads the owner's terms with the read-only
     secret and scans the working tree.
  4. System reports green.
- Extensions: 3a. A change re-introduces an owner term: the privacy job fails naming file, line and term
  kind. 3b. A PR comes from a fork: the privacy job has no secret and is skipped; the owner re-runs it on
  merge to `main`.

### UC-5 Owner migrates, cuts over and purges

- Level: summary · Primary actor: owner, with the orchestrator · Goal: data only in the database.
- Main success scenario:
  1. Orchestrator captures the baseline from `main` (kept outside git).
  2. The template learns to read profiles from bundles and the database (D1–D5 deliverables).
  3. Migration loads today's profile into Neon and verifies it against the baseline; owner holds an
     export.
  4. Cutover switches production to the database; production matches the baseline.
  5. Owner takes a fresh export; owner data is removed from the working tree.
  6. Owner takes a final export and a mirror; history is rewritten and force-pushed; releases are
     re-pointed; the repo is renamed; GitHub Support is asked to purge.
  7. History scan finds nothing; production still matches the baseline.
- Extensions: 3a / 4a. Any baseline difference: stop; nothing is deleted until it is resolved. 6a. A
  stray branch or open PR exists: stop until it is merged or closed. 6b. Support has not confirmed:
  recorded as residual risk, tracked in `resume.md`.

## 7. Acceptance criteria

### A. Profile store

- **AC-1.1** Given production after cutover, when the repository's `src/`, `public/` and `scripts/` are
  inspected, then no file holds any D3 content of the owner, and the production build still renders the
  owner's site.
- **AC-2.1** Given the read-only credential, when it attempts an insert, update or delete, then the
  database refuses it.
- **AC-3.1** Given a database profile with a Portuguese text that adds a figure, when a build reads it,
  then the build fails naming that path.
- **AC-4.1** Given an empty Neon database, when the schema command and an import of the example bundle
  run, then a build against it renders the example site and `pnpm test:e2e` passes against it.

### B. Bundles

- **AC-5.1 / AC-8.1** Given a database holding a profile, when it is exported, imported unchanged and
  exported again, then both exports are identical and the database content is unchanged.
- **AC-6.1** Given an invalid bundle, when it is imported, then the database is unchanged and every
  problem is listed by path.
- **AC-6.2** Given an import interrupted mid-write, when the database is read, then it holds the profile
  from before the import.
- **AC-7.1** Given any import, when it starts, then a backup export exists outside the repository before
  the first write, and its path is printed.
- **AC-9.1** Given the default export and backup locations, when `git status` runs after an export, then
  no new file appears, and default locations resolve outside the repository.
- **AC-10.1** Given the docs, when a reader follows the restore procedures on a test database, then both
  point-in-time restore and restore from export bring back the earlier profile.
- **AC-11.1** Given a bundle with one changed answer, when the preview runs, then it reports exactly that
  item and writes nothing.

### C. Build and scripts

- **AC-12.1** Given a production build from the database, when the database is made unreachable and the
  e2e journeys run against that deployment, then they pass; given request logs, then no request opened a
  database connection.
- **AC-13.1** Given `VERCEL_ENV=production` and no credential or opt-in, when the build runs, then it fails
  naming the missing setting; given the explicit opt-in, then it builds the example; given no
  `VERCEL_ENV`, then it builds the example.
- **AC-13.2** Given credentials pointing at an unreachable host, when a production build runs, then it
  fails within 60 s naming the cause.
- **AC-14.1** Given production after cutover, when `/marcio-alves-resume.pdf` and `/marcio-alves.jpg` are
  requested, then they answer 200 with bytes and content types equal to the baseline, under the same CSP.
- **AC-15.1** Given a corpus change in the selected profile, when `pnpm rag:build` runs, then the index in
  that profile matches the corpus and the index check passes; without the rebuild, it fails.
- **AC-16.1** Given the example profile, when `pnpm sites:ingest --check` and `pnpm notes:build` run, then
  they read and write the example bundle and no file under `src/profile` changes.
- **AC-17.1** Given the database profile, when `pnpm eval:assistant --only <case> --runs 1` runs, then it
  reads that case from the database.
- **AC-18.1** Given the publish command, when the owner runs it, then a production deployment of `main`
  starts and its URL is printed.
- **AC-19.1** Given the example profile and the owner's profile, when each is built, then page tokens,
  share image and tab icon use that profile's colours; no owner colour file is in the repository.

### D. Answers as data

- **AC-21.1** Given the owner's record and copy (while still in the repository), when every intent,
  company, project and technology answer and every topic page is rendered from the converted data and
  from the current TypeScript copy, in every published locale, then the outputs are identical.
- **AC-21.2** Given the example profile, when the same comparison runs, then outputs are identical.
- **AC-22.1** Given a template naming a fact id the record lacks, or writing a figure literally, when the
  profile is validated, then validation fails with the template's path.
- **AC-23.1** Given the example profile with one intent's copy removed, when that intent's question is
  asked, then the fast path does not answer it from that intent, with no core change.

### E. Example and docs

- **AC-24.1** Given a fresh clone with no `.env.local`, when `pnpm install && pnpm verify && pnpm build`
  run, then all pass with the example profile.
- **AC-25.1** Given the test and e2e sources, when the privacy scan runs with the owner's terms, then it
  finds nothing; given the example's terms, then hits occur only in the example bundle.
- **AC-26.1** Given the docs, when a reviewer follows them on a new Neon project with the example bundle
  (UC-3), then the site deploys from that database without consulting the code.
- **AC-27.1** Given the README, when read, then it describes a template, links the live example
  deployment, and contains no owner record content.

### F. Migration and cutover

- **AC-29.1** Given the baseline, when its location is checked, then it is outside the repository and was
  captured from a build of the `main` commit that precedes the first POR-88 merge.
- **AC-30.1** Given a build that differs from the baseline in one answer, when the comparison runs, then
  it reports exactly that difference; given an identical build, then it reports zero.
- **AC-31.1** Given the migration, when it completes, then round trip holds, the comparison against a
  local build from Neon reports zero differences, and the owner has confirmed holding an export.
- **AC-32.1** Given cutover, when the comparison runs against `https://marciomariani.dev`, then it reports
  zero differences, `/api/health` shows the deployed commit, and `eval:assistant` pass rates are ≥ the
  baseline run's, case by case.

### G. Purge

- **AC-33.1** Given `main` after D8, when the working-tree privacy scan runs with the owner's terms, then
  it reports zero matches, and `public/` holds only example assets.
- **AC-34.1** Given the remote after D9, when the history-mode scan runs over every branch, tag and notes
  ref (fresh mirror clone), then it reports zero matches in blobs, paths, commit messages and tag messages.
- **AC-35.1** Given a planted owner term in a test file, when the scan runs, then the output names the
  file, line and kind and does not contain the term.
- **AC-36.1** Given a PR from this repository that adds an owner term, when CI runs, then the privacy job
  fails.
- **AC-37.1** Given the rewritten history, when author and committer emails are listed, then every one is
  the noreply address and author names are unchanged; the commit count on `main` is unchanged.
- **AC-38.1** Given the releases page, when each release is opened, then its tag resolves to a rewritten
  commit; given the next merge to `main`, then `semantic-release` publishes the next version.
- **AC-39.1** Given the rename, when `package.json`, the repo name and the Vercel Git connection are
  checked, then each uses the neutral name and a push to `main` still deploys production.
- **AC-40.1** Given the Support request, when `resume.md` is read, then it records the ticket and its
  status; after confirmation, fetching a `refs/pull/<n>/head` returns only rewritten commits.
- **AC-41.1** Given the purge report, when read, then it lists PRs and issues mentioning owner terms by
  number and kind only.
- **AC-NFR-8.1** Given the deliverable log in `resume.md`, when D8 and D9 start, then each records the
  export (and for D9 the mirror) taken immediately before it.

## 8. Deliverable breakdown

Ids are POR-88 sub-deliverables (the orchestrator assigns PR keys). **Owner** marks a step that needs
the owner's credentials or action on his machine. One deliverable = one PR, merged on green (D21);
D0, D6 and D9 are mostly operations and may have small or no PRs.

| Id  | Deliverable                                                                                                                                                                                                                                                     | FR / AC                                                                    | Depends on            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------- |
| D0  | **Baseline**: comparison tool (FR-30) and the owner's baseline captured from `main` outside git; baseline `eval:assistant` run. **Owner**                                                                                                                       | FR-29, FR-30, AC-29.1, AC-30.1                                             | POR-87, POR-66        |
| D1  | **Profile bundle**: bundle format and loader, validation incl. generic checks (D17), example profile (Ada, en + pt-BR, placeholder assets, own index) as a bundle; build/test/scripts select it without credentials                                             | FR-3, FR-13 (example side), FR-24, FR-25, AC-13.1 (no-VERCEL_ENV), AC-24.1 | D0                    |
| D2  | **Answers and copy as data**: template engine, conversion of `en` and `pt-BR` answers, topics, vocabulary, ui/site/about/global-error copy; equivalence tests against the TS copy for owner and example                                                         | FR-20–23, AC-21.x, AC-22.1, AC-23.1                                        | D0                    |
| D3  | **Neon store**: schema command, read-only and owner roles, import/export/preview, pre-import backup, default locations ignored, backup/restore docs                                                                                                             | FR-1, FR-2, FR-4–11, AC-2.1, AC-4.1, AC-5–11                               | D1                    |
| D4  | **Build and scripts on the store**: build reads DB per D8, emits assets at profile URLs, brand tokens at build; `rag:*`, `notes:build`, `sites:ingest`, `eval:assistant` read/write the selected profile; publish command; no runtime DB access + boundary rule | FR-12–19, NFR-2–6, NFR-9, AC-12–19                                         | D2, D3                |
| D5  | **Template docs**: profile/DB setup guide, README as template (absorbs POR-70), CONTRIBUTING, ADRs (FR-28)                                                                                                                                                      | FR-26–28, AC-26.1, AC-27.1                                                 | D4                    |
| D6  | **Owner migration**: convert today's profile to an owner bundle outside git, import into Neon, round trip + zero baseline diff from a local DB build, owner export confirmed. **Owner**                                                                         | FR-31, AC-31.1                                                             | D4                    |
| D7  | **Production cutover**: Vercel prod + preview read-only credential, deploy, zero diff against production, eval pass rates, publish command verified, fresh export. **Owner**                                                                                    | FR-32, AC-32.1, AC-12.1, AC-14.1, AC-18.1                                  | D6                    |
| D8  | **Purge working tree + privacy scan**: remove every D15 item, genericise ADRs/tests/.env.example, rename `package.json`, privacy scan (tree + history modes) and its CI job                                                                                     | FR-33–36, AC-1.1, AC-25.1, AC-33.1, AC-35.1, AC-36.1                       | D5, D7                |
| D9  | **History rewrite + rename**: final export and bare mirror, filter-repo (paths, text, messages, emails), force-push branches/tags/notes, re-point releases, rename repo, reconnect Vercel, Support request, purge report, re-verify production. **Owner**       | FR-37–41, AC-34.1, AC-37–41.1, AC-NFR-8.1                                  | D8, no open PR/branch |

### Parallel sets

| Set | Deliverables (implement in parallel, merge in series) |
| --- | ----------------------------------------------------- |
| S0  | D0                                                    |
| S1  | D1, D2                                                |
| S2  | D3                                                    |
| S3  | D4                                                    |
| S4  | D5, D6                                                |
| S5  | D7                                                    |
| S6  | D8                                                    |
| S7  | D9                                                    |

D1 and D2 are parallel: D1 owns `src/profile/{index,schema}.ts`, the example bundle and the loaders; D2
owns `src/core/assistant/**` answer rendering and `src/profile/copy/**`. Their only shared point is how
the copy data is placed in a bundle, which D2 delivers as data D1's loader includes when D3/D4 merge;
the architect fixes that interface before S1 starts. D5 and D6 are parallel (docs vs owner operation).

### Dependency map

```
D0 ← POR-87, POR-66
D1 ← D0 · D2 ← D0
D3 ← D1
D4 ← D2, D3
D5 ← D4 · D6 ← D4
D7 ← D6
D8 ← D5, D7
D9 ← D8 (+ no open PR or stray branch; final export + mirror taken)
```

Critical path: D0 → D1 → D3 → D4 → D6 → D7 → D8 → D9. D2 is the largest deliverable (two locales of
answer prose, ≈ 3,000 lines of TypeScript) and has slack only while D1 → D3 run; it may be split by answer
group (boundaries, career, expertise, topics + vocabulary + interface copy) behind one engine PR.

### Risks

| Risk                                                                                                             | I×P    | Response                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data loss: owner data deleted before the database copy is verified, or the database is the only copy and is lost | 5×2=10 | Eliminate ordering risk: NFR-8 gates D8/D9 on verified cutover and fresh exports; pre-import backups (FR-7); Neon restore window + local exports (FR-10).                                                                 |
| History rewrite incomplete: PR refs, Support-dependent purge, old clones and worktrees                           | 4×4=16 | Mitigate + accept: rewrite every ref incl. notes; history-mode scan on a fresh mirror (AC-34.1); Support request tracked (FR-40); local worktrees and agent clones deleted and re-cloned; residual copies accepted (NG7). |
| Force-push breaks releases, `semantic-release` sequence or Vercel's Git link                                     | 4×3=12 | Mitigate: re-point releases and notes refs (FR-38), verify next release and a production deploy after D9 (AC-38.1, AC-39.1); bare mirror allows rollback.                                                                 |
| Templated answers drift from today's prose (whitespace, plurals, articles, locale formatting)                    | 4×4=16 | Mitigate: AC-21.1 equivalence for every intent/entity and locale while the TS copy still exists; FR-30 baseline before cutover.                                                                                           |
| Production build silently ships the example profile                                                              | 5×2=10 | Eliminate: D8 rule, AC-13.1, baseline diff at cutover.                                                                                                                                                                    |
| Owner data leaks into public CI logs, fixtures or snapshots during D1–D7                                         | 4×3=12 | Mitigate: scan never prints terms (FR-35); CI builds only the example; anything committed before D8 is purged by D9.                                                                                                      |
| Neon free-plan limits or restore window shorter than expected                                                    | 2×3=6  | Accept: data is a few MB; local exports cover older restores (D18).                                                                                                                                                       |
| PR titles/bodies on GitHub still mention employers or products                                                   | 2×4=8  | Accept: PR history kept by owner decision (D11); FR-41 lists them for manual edit.                                                                                                                                        |
| In-flight work (POR-87, POR-66) merges late or conflicts                                                         | 3×3=9  | Mitigate: D0 waits for both (D14); no rewrite while any PR is open.                                                                                                                                                       |
