# Resume — profile-database

_Last updated: 2026-10-29 (plan approved) · Base: `main` · Tasks: POR-89…POR-99 (POR-88 = this plan's docs PR)_

## How to resume (read this first)

1. Open the docs in this folder: `prd.md` (decisions D1–D21, requirements, ACs, deliverables §8),
   `design.md` (store, build pipeline, templates, runbooks; change sequence and file ownership §12),
   `test-plan.md` (every AC → its tests; ambiguities resolved in §9), `index.html` (human view).
2. Load skills: `dev-workflow`, `parallel-worktrees`, `meaningful-tests`, `clean-architecture`,
   `clean-code`, `release-it`, `nextjs-server-client`, `testing-unit-integration`, `testing-e2e`.
3. Run `/execute-plan` (or paste the continuation prompt below) and work the next set.

## Delivery model (same as i18n-whitelabel; overrides the generic one-PR-per-ticket rule)

- **One deliverable = one branch `por-<nn>-<slug>` off up-to-date `main` = one PR** titled
  `POR-<nn>: <resumo em português>`, non-technical Portuguese body with how to test.
- Conventional Commits ending with the key, e.g. `feat(profile): … (POR-90)`. commitlint enforces it.
- **No `Co-Authored-By`, no Claude footer, never `--no-verify`.** Avoid the substring "main" in branch
  names and commit text next to "push" (the `guard-git.sh` hook false-positive).
- Merge when every CI check is green, delete the remote branch, then verify production.
- Implementers work in local worktrees under `.claude/worktrees/`; only the orchestrator pushes, opens and
  merges PRs.
- Route around a blocked deliverable; record why here; report at the end.
- **Owner steps** (D0 baseline, D6, D7, D9, plus M3.1 Neon rehearsal, M5 walkthrough, M8.2 planted-term
  run) need Marcio's credentials or machine. Prepare everything, then stop and ask for exactly the action
  needed. Never print or commit secrets; the baseline and owner bundle live outside git.
- eval:assistant: gpt-4o-mini for assistant and judge, `--runs 1` (and `--only <id>`) only.

## Owner decisions taken at approval (2026-10-29)

- Neon Postgres is the **only** copy of the owner's profile; publishing = import + redeploy (build-time read).
- Keep the GitHub repo; rewrite history (filter-repo), force-push, ask GitHub Support to purge refs/pull.
- Neutral repo/package name `grounded-portfolio`; Neon free plan; README keeps the live-site link;
  commit author name kept, email → GitHub noreply.
- Interim D4a → D7: production builds from committed `profiles/owner/` with
  `PROFILE_BUNDLE_DIR=profiles/owner` set by the owner on Vercel Production + Preview **before D4a merges**.
- Example profile = Ada Rivera (en + pt-BR). POR-70's README work is absorbed by D5; POR-67 dropped.

## Prerequisite outside this plan

- **POR-66** (i18n-whitelabel: bilingual fast path, enables PT) is not merged; D0 waits for it
  (D14). Its worktree `.claude/worktrees/agent-ae2b4b82b3bb07f53` (branch `por-66-portuguese-enabled`)
  has no commits beyond POR-65 — do POR-66 first, per `docs/plan/i18n-whitelabel/`.

## Status snapshot

- Overall: **in_progress** (0/11 deliverables merged). Plan docs: POR-88 (PR pending).
- Current set: prerequisite POR-66, then **S0** = D0 (POR-89). Blocked: none yet.

## Deliverables

| Key    | Id  | Scope                                                                        | Depends on | Set | Status  | Branch | PR  | Notes                         |
| ------ | --- | ---------------------------------------------------------------------------- | ---------- | --- | ------- | ------ | --- | ----------------------------- |
| POR-89 | D0  | Baseline tool + owner baseline outside git + baseline eval                   | POR-66     | S0  | pending | —      | —   | owner captures baseline       |
| POR-90 | D1  | Profile bundle format/loader, generic checks, Ada example bundle             | D0         | S1  | pending | —      | —   | parallel with D2              |
| POR-91 | D2  | Template engine; answers + copy as data; TS-vs-template equivalence          | D0         | S1  | pending | —      | —   | largest; may split by group   |
| POR-92 | D3  | Neon store: schema, roles, import/export/diff, backups, docs                 | D1         | S2  | pending | —      | —   | merge before D4a              |
| POR-93 | D4a | Build materialize step, source selection, assets at URLs, next.config guard  | D1, D2     | S2  | pending | —      | —   | owner sets PROFILE_BUNDLE_DIR |
| POR-94 | D4b | Build/scripts read the DB; publish command; no-runtime-DB rule               | D3, D4a    | S3  | pending | —      | —   |                               |
| POR-95 | D5  | Template docs: DB setup guide, README template, CONTRIBUTING, ADRs           | D4b        | S4  | pending | —      | —   | absorbs POR-70                |
| POR-96 | D6  | Owner migration into Neon, round trip, zero baseline diff, owner export      | D4b        | S4  | pending | —      | —   | owner                         |
| POR-97 | D7  | Production cutover: reader creds on Vercel, zero diff vs prod, eval, export  | D6         | S5  | pending | —      | —   | owner                         |
| POR-98 | D8  | Purge working tree, rename package, privacy scan + CI job                    | D5, D7     | S6  | pending | —      | —   |                               |
| POR-99 | D9  | History rewrite, force-push, re-point releases, rename repo, Support request | D8         | S7  | pending | —      | —   | owner; no open PR/branch      |

## Parallelization map (design §12, revised)

- S0: D0 · S1: D1 ∥ D2 · S2: D3 ∥ D4a (merge D3 first) · S3: D4b · S4: D5 ∥ D6 · S5: D7 · S6: D8 · S7: D9
- Critical path: D0 → {D1, D2} → D4a → D4b → D6 → D7 → D8 → D9.

## Acceptance criteria ledger

Every AC maps to tests in `test-plan.md` §2. Tick here as each deliverable merges.

- [ ] D0 · [ ] D1 · [ ] D2 · [ ] D3 · [ ] D4a · [ ] D4b · [ ] D5 · [ ] D6 · [ ] D7 · [ ] D8 · [ ] D9

## Decisions & constraints (carry-forward)

- Build-time `pnpm profile materialize` writes git-ignored `src/profile/generated/**` + public assets;
  runtime never touches the DB (`pg`, `yaml` are devDependencies; dependency-cruiser rule
  `no-runtime-profile-store`).
- Store: immutable content-addressed revisions (`bytea`, SHA-256) + one `head` pointer swapped in a
  serializable transaction; roles `profile_reader` (Vercel/CI) and `profile_owner` (owner machine only);
  no Vercel–Neon marketplace integration.
- Selection: explicit `PROFILE_SOURCE` wins; else DB URL → DB, bundle dir → bundle, non-production →
  example, production → fail. An unreachable DB never falls back.
- Templates: `{{path | filter}}`, blocks `#if/#each/#bullets/#numbered/#with`; compile to the existing
  `AnswerSet`; validated paths, ids, no literal figures.
- Libraries: `pg` (not the Neon serverless driver), `yaml` 2.x strict, Vercel REST
  `POST /v13/deployments?forceNew=1`, `git filter-repo --sensitive-data-removal`
  `--prune-empty never --prune-degenerate never`.
- CI Postgres 17 with generated TLS cert (`NODE_EXTRA_CA_CERTS`); no test-only TLS bypass.

## Continuation prompt

> Resume feature profile-database. Read docs/plan/profile-database/{prd,design,test-plan}.md and this
> resume.md. If POR-66 is not merged, finish it first per docs/plan/i18n-whitelabel. Then work the next
> set from the table above: for each deliverable spawn an implementer (isolation: worktree) → test-validator
> (meaningful-tests) → pr-reviewer; the orchestrator pushes `por-<nn>-<slug>`, opens the PR, merges on
> green, verifies production and updates this file. Stop only for owner steps, asking for the exact action.
