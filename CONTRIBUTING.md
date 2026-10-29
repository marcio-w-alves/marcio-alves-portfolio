# Contributing

## Setup

```bash
corepack enable
pnpm install
pnpm exec playwright install chromium   # once, for the browser tests
cp .env.example .env.local              # OPENAI_API_KEY is optional
pnpm dev
```

Without `OPENAI_API_KEY` the assistant answers everything the fast path
recognises and says plainly what it cannot. The key is only needed for
questions that go to the model, for `pnpm rag:build` and for
`pnpm eval:assistant`. It is read on the server only and never reaches the
browser.

## How work is organised

- Each change belongs to a task with a key, `POR-<nn>`.
- Branches are named `por-<nn>-<slug>`.
- One pull request per task, titled `POR-<nn>: <summary>`. Its description is
  in Portuguese, plain and non-technical, and says how to test the change on
  the live site.
- Commits follow Conventional Commits, and the subject ends with the task key:
  `feat(ui): add the chat composer (POR-10)`. commitlint rejects a commit
  without it. The type drives the version (see Versioning in the README):
  `feat` is a minor release, `fix` a patch, `!` a major one.

## Gates

Hooks run on every commit and push (lefthook), and CI runs the same gates on
every pull request. None of them is ever skipped: no `--no-verify`. A failing
gate is fixed, never bypassed.

| Gate                                                      | Command                                          | When                                                |
| --------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Lint (type-aware), format                                 | `pnpm lint`, `pnpm format:check`                 | commit, CI                                          |
| Commit message                                            | commitlint                                       | commit, CI                                          |
| Types, module boundaries, tests                           | `pnpm typecheck`, `pnpm boundaries`, `pnpm test` | push, CI (tests via `pnpm test:coverage`)           |
| Coverage floor on `src/core` and `src/infrastructure`     | `pnpm test:coverage`                             | CI                                                  |
| Build                                                     | `pnpm build`                                     | CI                                                  |
| Browser journeys, motion, accessibility, security, search | `pnpm test:e2e`                                  | CI                                                  |
| Performance budget                                        | `pnpm lighthouse` (after `pnpm build`)           | CI                                                  |
| Assistant grounding                                       | `pnpm eval:assistant` (needs the key)            | locally, when answers, prompts or the record change |

`pnpm verify` runs the commit and push gates in CI's order.

## Writing code

- `src/core` stays framework-free: no Next.js, React or vendor SDK, only Zod.
  An outward need becomes a port, implemented in `src/infrastructure` and
  bound in `src/composition-root.ts`.
- The assistant reaches data only through allow-listed actions with strict
  schemas.
  Every fact in the knowledge base carries its source.
- Styling is Tailwind utilities over the tokens in `src/ui/globals.css`, and
  nothing else. A value no utility can express is a missing token: add it to
  `@theme`, and register `text`, `leading`, `tracking`, `font-weight` and
  `radius` tokens in `THEME_TOKENS` (`src/ui/cn.ts`).
- Server Components by default; `'use client'` only on the smallest
  interactive leaf.
- Comments explain why, never what.

## Changing the record

1. Edit `src/profile/knowledge/*`; every entry keeps its `source`. `src/profile/README.md`
   lists every file of the profile.
2. `pnpm rag:build`. CI fails while the index is stale.
3. `pnpm eval:assistant`.

## Changing the design

1. Port the change into the tokens and components.
2. Check it in the browser at desktop and phone widths, then `pnpm test:e2e`.

## Tests

- Test what a visitor observes: roles, names, text, what an action does.
  Never internals or class names.
- Mock only the network, with MSW. Browser tests intercept the network only
  where the README says why.
- No fixed sleeps: wait for conditions.
- Every bug fix comes with a test that fails without it.
- Coverage is a floor, not a target: `src/core` and `src/infrastructure` must
  stay above the thresholds in `vitest.config.mts`, two points under their
  measured baseline. Lowering one needs a stated reason in the pull request.
