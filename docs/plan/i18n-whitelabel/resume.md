# Resume — i18n-whitelabel

_Last updated: 2026-10-28 · Base: `main` · Tasks: POR-41…POR-70 (POR-71 = this plan's docs PR)_

## How to resume (read this first)

1. Open the docs in this folder: `prd.md` (requirements, ACs, task table §8), `design.md`
   (structure, per-task design §12), `test-plan.md` (every AC → its tests), `index.html` (human view).
2. Load skills: `dev-workflow`, `parallel-worktrees`, `meaningful-tests`, `clean-architecture`,
   `nextjs-server-client`, `react-component-design`, `tailwind-styling`, `figma-vector-match`
   (fidelity), `testing-unit-integration`, `testing-e2e`, `testing-nonfunctional`, `release-it`.
3. Run `/execute-plan` (or paste the continuation prompt below) and work the next set.

## Delivery model for this project (overrides the generic one-PR-per-ticket rule)

The owner authorised this, and the repository works this way (memory: "Always push and merge",
"Run the plan to completion"):

- **One task = one branch `por-<nn>-<slug>` off up-to-date `main` = one PR** titled
  `POR-<nn>: <resumo em português>`. The PR body is in Portuguese, non-technical, and says how to test
  on the live site (examples: any merged PR from #38 on).
- Commits follow Conventional Commits and end with the key: `feat(i18n): … (POR-64)`. commitlint enforces it.
- **No `Co-Authored-By` and no Claude footer. Never `--no-verify`.**
- Merge when every CI check is green, using the scratchpad `merge-if-green.sh` pattern: the PR is
  open, its checks exist, and all of them pass. Then delete the remote branch, pull `main`, and verify
  production (`/api/health` commit, `pnpm fidelity:live`, the feature on https://marciomariani.dev).
- Implementers work in local worktrees under `.claude/worktrees/`. Only the orchestrator pushes and
  opens or merges PRs. Leave no stray remote branches.
- Route around a blocked task: continue with tasks that don't depend on it, record why it is blocked here,
  and report it at the end.
- **IDX tasks (55 → 56 → 65)** rebuild the committed retrieval index with `pnpm rag:build`, which needs
  `OPENAI_API_KEY` in the main checkout's `.env.local`. Copy that file into the worktree and never commit
  or print it. Run these tasks strictly in series.
- Fidelity: `pnpm fidelity` with the design served on :4410. The design export comes from the artifact
  https://claude.ai/artifact/5MWUgvLNhx4tcvBCdNtpYb (read it via the Artifact tool). From POR-69 on it
  is committed under `design/`. English boards need ≥99.9%. Masks are allowed up to 3% of a board;
  departures (with a reason) only for Main, Mobile and WelcomeScreen in POR-68.

## Changes on `main` after the plan was written (fold into each task)

- **POR-37 (#44), by the owner:**
  - A new hand-made résumé `public/marcio-alves-resume.pdf`.
  - Deel backlog, Roots Slack-bot and Roots initial-load metrics removed.
  - A 1258-line owner document `src/core/knowledge/data/knowledge-base.md`, split by
    `pnpm notes:build` into `notes.json` as a retrieval category with evidence tags (explained in the
    system prompt).
  - Résumé passages get a guaranteed share of search results.

  Consequences:
  - The document and `notes.json` belong to the profile (POR-52) and need a Portuguese counterpart or
    an explicit English-only decision (POR-65).
  - Metric literals and ids the plan cites may no longer exist: re-read the record before each task.
  - **POR-67 (generated PDF) is on hold:** the owner just supplied a new hand-made PDF, so replacing
    it with a generated one needs his confirmation. Until then, keep his PDF and route around.

## Status snapshot

- Overall: **in_progress** (0/30 tasks merged). The plan docs are approved; POR-71 lands them on `main`.
- Current set: **S1** = POR-41, 42, 47, 48, 57, 62. Blocked: none.

## Deliverables

| id     | scope                                                         | depends on     | set | status  | branch | PR  | notes                         |
| ------ | ------------------------------------------------------------- | -------------- | --- | ------- | ------ | --- | ----------------------------- |
| POR-71 | Plan docs (`docs/plan/i18n-whitelabel`)                       | —              | —   | pending | —      | —   | land first                    |
| POR-41 | Offer filter keeps factual sentences                          | —              | S1  | pending | —      | —   |                               |
| POR-42 | Router stops refusing valid questions                         | —              | S1  | pending | —      | —   |                               |
| POR-43 | Forged context intents never throw                            | 42             | S2  | pending | —      | —   |                               |
| POR-44 | Boundary rules, server-only, knowledge↔assistant cycle        | 43             | S3  | pending | —      | —   |                               |
| POR-45 | Limiter/budget memory, IPv6 /64, interrupted tokens           | 44, 49         | S4  | pending | —      | —   |                               |
| POR-46 | Embeddings breaker/abort, tool exceptions, adapter validation | 44, 45         | S5  | pending | —      | —   |                               |
| POR-47 | Eval harness (N runs, calibration, avoids, new cases)         | —              | S1  | pending | —      | —   | eval stays local              |
| POR-48 | Coverage thresholds core/infrastructure                       | —              | S1  | pending | —      | —   |                               |
| POR-49 | Core code health                                              | 41, 42, 43     | S3  | pending | —      | —   |                               |
| POR-50 | Link allow-list                                               | 46             | S6  | pending | —      | —   |                               |
| POR-51 | Model answer quality                                          | 46, 47, 50     | S7  | pending | —      | —   |                               |
| POR-52 | Profile folder + knowledge injection                          | 44, 46, 47, 49 | S6  | pending | —      | —   |                               |
| POR-53 | Helpers out of `src/app` (`src/http`, `src/site`)             | 52, 45         | S7  | pending | —      | —   |                               |
| POR-54 | Fast path from the record; owner wording to the profile       | 52, 51         | S8  | pending | —      | —   |                               |
| POR-55 | Record corrections                                            | 54, 53, 58     | S9  | pending | —      | —   | IDX                           |
| POR-56 | Product-site ingestion                                        | 55, 51         | S10 | pending | —      | —   | IDX                           |
| POR-57 | Retry/edit cancels the in-flight answer                       | —              | S1  | pending | —      | —   |                               |
| POR-58 | Single client/server contracts                                | 57, 43, 53     | S8  | pending | —      | —   |                               |
| POR-59 | Knowledge base out of the client bundle                       | 58, 54         | S9  | pending | —      | —   |                               |
| POR-60 | SSE heartbeat, time limit, maxDuration, parser                | 58             | S9  | pending | —      | —   |                               |
| POR-61 | UI code health                                                | 59             | S10 | pending | —      | —   |                               |
| POR-62 | Motion e2e waits on conditions                                | —              | S1  | pending | —      | —   |                               |
| POR-63 | EN catalog, brand tokens, fixture tests, full whitelabel      | 61, 60, 55     | S11 | pending | —      | —   | pixel-neutral                 |
| POR-64 | Locale routing (PT off)                                       | 63             | S12 | pending | —      | —   | starts with the routing spike |
| POR-65 | Portuguese content (still off)                                | 64, 56         | S13 | pending | —      | —   | IDX                           |
| POR-66 | Bilingual fast path; enables PT                               | 65, 51         | S14 | pending | —      | —   |                               |
| POR-67 | Generated résumé PDF EN/PT                                    | 65, 55         | S14 | on hold | —      | —   | owner must confirm            |
| POR-68 | Phone contact + evidence line; departures                     | 63, 55, 67     | S15 | pending | —      | —   |                               |
| POR-69 | Fidelity in CI + design export                                | 66, 68         | S16 | pending | —      | —   |                               |
| POR-70 | README, CONTRIBUTING, repo settings                           | 41–69          | S17 | pending | —      | —   | `gh repo edit`                |

## Parallelization map (sets: implement in parallel, merge in series)

S1: 41, 42, 47, 48, 57, 62 · S2: 43 · S3: 44, 49 · S4: 45 · S5: 46 · S6: 50, 52 · S7: 51, 53 ·
S8: 54, 58 · S9: 55, 59, 60 · S10: 56, 61 · S11: 63 · S12: 64 · S13: 65 · S14: 66, 67 · S15: 68 ·
S16: 69 · S17: 70. Some edges exist only because tasks edit the same file; they are listed in PRD §8.

## Acceptance criteria ledger

Every AC is listed with its tests in `test-plan.md` §2. Tick an AC here when its task merges:

- [ ] POR-41 · [ ] POR-42 · [ ] POR-43 · [ ] POR-44 · [ ] POR-45 · [ ] POR-46 · [ ] POR-47 · [ ] POR-48
- [ ] POR-49 · [ ] POR-50 · [ ] POR-51 · [ ] POR-52 · [ ] POR-53 · [ ] POR-54 · [ ] POR-55 · [ ] POR-56
- [ ] POR-57 · [ ] POR-58 · [ ] POR-59 · [ ] POR-60 · [ ] POR-61 · [ ] POR-62 · [ ] POR-63 · [ ] POR-64
- [ ] POR-65 · [ ] POR-66 · [ ] POR-67 · [ ] POR-68 · [ ] POR-69 · [ ] POR-70

## Decisions & constraints (carry-forward; do not reopen)

- Owner decisions D1–D33 are in PRD §3. Key ones:
  - EN unprefixed, PT under `/pt` with the same slugs; no auto-redirect.
  - The question's language wins.
  - Each locale keeps its own conversation per page.
  - Translation PRs merge on green.
  - One profile folder that a reuser edits in their fork.
  - Headline: "Senior Frontend Engineer with tech-lead responsibilities".
  - Availability: "Brazil · remote · UTC−3 · open to opportunities".
  - Toptal is the employer.
  - Overlapping roles are tagged "Contract".
  - FictionDraft stays a concept.
  - Product-site text never becomes a claim about Marcio.
  - The eval never runs in CI.
  - The "three names" finding is ignored.
- Design (`design.md` §1):
  - In-house typed catalog (no next-intl).
  - `app/[locale]` with an EN rewrite, using `next/root-params`.
  - Profile at `src/profile`; core never imports it, and knowledge is injected.
  - `src/core/chat` holds the shared contracts.
  - `server-only` guards.
  - Libraries: `@react-pdf/renderer`, `robots-parser`, `@mozilla/readability`, `pdfjs-dist` (tests).
- Project rules:
  - Tailwind only, over tokens.
  - Server Components by default.
  - `src/core` stays framework-free (dependency-cruiser).
  - Every bug fix ships a regression test that fails without it.
  - Tests are behavioural, with MSW only at the HTTP boundary.

## Continuation prompt

> Resume feature i18n-whitelabel in /Users/marciomariani/Projects/marcio-alves-portfolio. Read
> docs/plan/i18n-whitelabel/{prd,design,test-plan}.md and this resume.md. The next set is the first
> one with pending tasks whose dependencies are all merged. For each task in it: spawn an implementer
> (isolation: worktree, branch `por-<nn>-<slug>` off main), then a test-validator (meaningful-tests),
> then a pr-reviewer, and loop on the findings. Then the orchestrator commits, pushes, opens
> `POR-<nn>: …` (Portuguese body), merges when CI is green, verifies production, removes the worktree
> and branch, and updates this file. Implement in parallel within a set and merge in series. Never
> Co-Authored-By, never --no-verify.
