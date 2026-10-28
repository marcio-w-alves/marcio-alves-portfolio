# marcio-alves-portfolio

Personal portfolio with an AI assistant that answers questions about my work,
grounded in documented sources and unable to invent what it does not know.

## Requirements

- Node >= 24
- pnpm 10 (`corepack enable`)

## Getting started

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

## Scripts

| Command                    | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `pnpm dev`                 | Development server                                   |
| `pnpm build`               | Production build                                     |
| `pnpm typecheck`           | Route types, then TypeScript, no emit                |
| `pnpm lint`                | ESLint, warnings treated as failures                 |
| `pnpm lint:fix`            | ESLint with autofix                                  |
| `pnpm format`              | Prettier, write                                      |
| `pnpm format:check`        | Prettier, verify only                                |
| `pnpm boundaries`          | Module-boundary rules                                |
| `pnpm test`                | Unit and integration tests (Vitest)                  |
| `pnpm test:motion`         | Motion and reduced-motion checks in Chromium         |
| `pnpm rag:build`           | Re-embed the knowledge corpus (needs the key)        |
| `pnpm eval:assistant`      | Grade the assistant end to end (needs the key)       |
| `pnpm fidelity`            | Compare every artboard with its page, pixel by pixel |
| `pnpm fidelity:references` | Re-render the design's artboards as references       |
| `pnpm verify`              | Every gate, in the order CI runs them                |

## Quality gates

Four checks guard the repository. Each one runs locally through a git hook and
again in CI, so a failure surfaces on the machine that caused it.

**ESLint** uses type-aware rules (`strictTypeChecked`), which read the type
checker rather than the syntax tree. That is what catches a floating promise or
an unnecessary condition — defects a syntax-only linter cannot see. Warnings
fail the run: a warning nobody must act on is noise.

**Prettier** owns formatting outright; ESLint's formatting rules are switched
off so the two can never disagree. The Tailwind plugin sorts every class list
into canonical order, which keeps diffs about behaviour instead of class order.

**dependency-cruiser** enforces the architecture. `src/core` may not import
Next, React, a vendor SDK, or anything from an outer layer; cycles and
unresolvable imports are rejected. Zod is the single allowed dependency inside
`src/core`, because the assistant's tool contracts are Zod schemas and those
schemas are policy, not an adapter.

**commitlint** requires Conventional Commits whose subject ends with its task
key, for example `feat(ui): add the composer (POR-10)`. The type drives the
automated version bump, so the format is load-bearing.

Hooks are installed by `pnpm install` (the `prepare` script). `pre-commit`
formats and lints what is staged, `commit-msg` validates the message, and
`pre-push` runs typecheck, lint and the boundary rules. Never bypass them with
`--no-verify`: fix the gate or fix what the gate found.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`.
The four static gates fan out from one matrix job, so adding a gate is one list
entry rather than a copied job. `build`, and `commits` on pull requests, run
alongside them. A final `ci` job summarises the rest, which lets branch
protection require one check instead of a list that has to be edited whenever a
job is added.

Setup is a composite action in `.github/actions/setup`: pnpm, Node from
`.nvmrc`, and a cached, frozen-lockfile install. Third-party actions are pinned
to commit SHAs, not tags — a tag can be moved to point at different code.

The build job is given no secrets, which is the check that environment
variables stay lazily validated: a build that needs a runtime credential fails
here.

The commit-message rule is enforced twice on purpose. The `commit-msg` hook
only protects whoever installed it; the `commits` job is the one nobody can
skip.

## Knowledge base

`src/core/knowledge` is the single source of truth for every fact the site and
the assistant present. Two layers live side by side on each role: condensed
fields that shape the interface, and `highlights` — the resume's bullet points
verbatim — which are the factual record retrieval searches. Where the design's
copy and the resume disagree, the resume wins.

Identifiers are literal unions, so a role citing a metric that does not exist
fails to compile. Tests cover what the type system cannot: chronology, one
record per id, and which roles overlapped.

Nothing is inferred. The resume states a country but not a city, so the city
is `null` and the assistant says it is not documented rather than guessing.

### Retrieval

The knowledge base is also flattened into categorized passages — profile,
experience, skills, education, languages, certifications, projects,
principles — one per resume statement, each naming its company and role. They
are embedded with `text-embedding-3-small` at 512 dimensions into
`src/infrastructure/retrieval/knowledge-index.json`, which is committed.

The index is built offline with `pnpm rag:build`, never during a build, because
the build must not need a secret; at runtime only the question is embedded.
The index records a hash of the corpus it came from, and a test fails the
moment the knowledge base changes without the index being rebuilt.

## Chat endpoint

`POST /api/chat` takes `{ message, history, context }` and answers as
Server-Sent Events in the contract of `src/core/assistant/assistant-event.ts`.
Everything in the request is untrusted: the body is read in pieces and cut off
at 32 KB (a `Content-Length` can lie), then validated by a strict schema —
1,200 characters per question, 24 turns of history at most, no unknown fields.

The stream is pulled one event at a time, so nothing is generated faster than
the visitor reads it; when they leave, the stream is cancelled and the
request's abort signal ends the model call behind it.

### Spending

The model is the only part that costs money, so it is fenced in layers.
Each client may send 40 requests in any ten minutes (429 with `Retry-After`
past that) and start 15 model answers; a visitor over the second limit gets a
free answer explaining it, with suggestions the fast path answers. A
context-free question already answered is replayed from cache, at no cost and
without counting against the visitor. Each instance also stops calling the
model after about two million tokens a UTC day.

All of that is in memory, so per instance: defence in depth, not a quota. The
hard ceiling is the monthly budget set on the OpenAI project, which is where
the spend is actually capped.

## Design tokens

`src/app/globals.css` is the whole visual vocabulary of the approved design,
"White & Ice" — white and ice neutrals, ink as the only accent, hairlines
instead of shadows — declared as Tailwind v4 `@theme` variables: surfaces,
ink, lines, the accent, a half-pixel type scale named for its values
(`text-13.5` is 13.5px), line heights, letter spacing, radii, hairlines and
shadows, one easing curve, two durations, the keyframes, and the layout
widths. Every visual decision is therefore a utility over a token —
`bg-ice`, `text-ink-muted`, `shadow-ring-strong`, `duration-fast`.

The corollary matters more than the list: **a value that cannot be written as
a utility is a missing token, not a licence to write CSS.** The only raw CSS is
what no utility can reach: the root line height (the design keeps the
browser's `normal`), the global focus ring, a text-rendering hint, the
`prefers-reduced-motion` collapse, and four tiny `@utility` rules.
`cn()` registers the custom tokens with tailwind-merge — which would otherwise
read `text-13` as a colour and drop it — and a test keeps that list in step
with the stylesheet.

`--color-ink-faint` is for icons, rules and decoration only; text uses
`--color-ink-muted`, which holds 5.5:1 or better on every surface.

Inter, Inter Tight and Geist Mono come from `next/font/google`: the same files
the design loads, downloaded at build and served from this site.

## Design fidelity

The design is the specification, and it is checked by pixels, not by eye.
`pnpm fidelity:references` renders every artboard of the design (served
locally with its own runtime) at its canvas size into `fidelity/reference/`.
`pnpm fidelity`, with `pnpm dev` running, renders each board's counterpart —
a development-only page under `/workbench/fidelity/` built from the real
components and the real record — at the same size, compares the two pixel by
pixel with anti-aliasing left out, and requires 99.9% of pixels to match on
every board. The full-screen states (a streaming answer, a failure, a long
follow-up…) are rebuilt the way the prototype builds them: real fast-path
answers replayed through the conversation's transitions.

`pnpm fidelity:live` checks the boards production renders as they are — the
welcome screen on a desktop and on a phone — against the live site, so a
deployment that differs from what was built locally is caught too. It found
one: a build that reused a stale stylesheet (see `next.config.ts`).

The references take three deliberate liberties with the prototype, each
explained where it is made: they omit its "Preview with scripted answers"
notice, they run its logic with the production contact data (GitHub linked,
the résumé not yet published), and they undo two of its timing artefacts — a
composer sized before its font loaded, and a conversation scrolled while
still rendering in.

## Architecture

Source dependencies point inward. `src/core` is plain TypeScript: it never
imports from Next.js, React, the OpenAI SDK or any other outer layer. This is
checked by `pnpm boundaries`, not left to discipline.

```
src/
  app/              Next.js routes — HTTP and UI adapters
  core/             Domain and use cases, framework-free
    assistant/      Streaming contract, ports, guardrails, tools
    knowledge/      Career entities and their sources
    use-cases/
  infrastructure/   Adapters: model, retrieval, GitHub, cache
  ui/               Presentational components
  composition-root.ts   The single place adapters are bound to ports
```

The assistant reaches data only through an allow-list of named actions. It is
never handed the knowledge base itself, and a question no action covers is
answered as undocumented rather than guessed.

### Two paths to an answer

**System 1** (`src/core/assistant/system1`) is a deterministic router over the
question. What it recognizes with certainty — every question the interface
suggests, the refusals, and technologies weighed against the record — it
answers straight from the knowledge base, instantly and without a model call.
What it is unsure of, it escalates instead of guessing: low-confidence
questions, definitions ("what is TypeScript?"), comparisons, questions naming
two companies, and anything long enough to carry several asks.

**System 2** (`src/core/assistant/system2`) is `gpt-4o-mini` acting only
through the allow-listed actions, for everything else — including any
question not written in English, since System 1's answers are, and requests
to do something (write code, a poem) rather than to learn about Marcio. The
loop is bounded: four rounds at most, the last one forced to write rather than
call another action, six actions per round run concurrently, 700 output tokens
a round. A circuit breaker stops calling the model after three consecutive
failures. Both paths produce the same response shape, so the interface never
knows which one answered, and if the model is unavailable — no key, an open
circuit, a failure before it said anything — System 1 still answers
everything it recognizes and says plainly what it cannot.

A test walks the whole suggestion graph — every topic question, then every
follow-up each answer offers, recursively — and requires the fast path to
answer all of it, so the interface can never suggest a question the assistant
cannot handle.

### Evaluation

`pnpm eval:assistant` runs a corpus of conversations
(`scripts/evaluation/cases.ts`) — career facts, technologies, companies,
profiles, location, undocumented details, off-topic requests, injection
attempts, follow-ups and other languages — through the production wiring. Each
answer's prose goes to an independent judge, a stronger model than the one
answering, together with the exact evidence the assistant had: the actions the
model ran and what they returned, or the knowledge base for the fast path. The
judge must back every claim with a passage it copies from that evidence, and
the script checks that the passage is really there; a claim without one is
re-checked once with only the evidence in view, then reported. Before grading,
the judge is calibrated on answers with planted fabrications and the run
aborts if it misses one. Deterministic checks cover the rest: which path
answered, refusals citing no source, the reply language, required and
forbidden phrases. It spends real tokens and needs the key, so it runs
locally rather than in CI.

## Deployment

Hosted on Vercel at **[marciomariani.dev](https://marciomariani.dev)**, built
from `main`. Every pull request gets its own preview deployment, which is what
the manual test steps in a pull request description point at.

The canonical origin comes from `siteUrl()` in `src/env.ts`: an explicit
`SITE_URL` wins, otherwise Vercel's production domain, otherwise localhost.
Previews therefore declare the production domain as canonical, so search
engines never index a preview URL as a second copy of the site. The value is
fixed when a deployment builds, so after attaching or changing a custom domain,
redeploy production for the canonical to follow. It is resolved
apart from the server secrets on purpose — page metadata needs it at build
time, and the build must never need a secret.

Nothing about the build is configured in this repository, because nothing needs
to be: Vercel detects Next.js, reads pnpm from the lockfile, and takes the Node
major from `engines.node` in `package.json`. That field is `24.x` rather than an
open range — the documented form Vercel resolves, and the honest one for a
project that pins every other version.

Environment variables are set in the Vercel project, never committed.
`.env.example` is the list, and `OPENAI_API_KEY` is server-side only: a model
credential behind a `NEXT_PUBLIC_` prefix would be readable by every visitor.

## Observability

Server code logs through `src/infrastructure/logging/logger.ts`: one JSON
object per line, `level`, `event` and `time` first, then flat primitive
fields. Information goes to stdout, warnings and errors to stderr, which is
what Vercel's log view parses and filters on. `src/core` never logs; it reports
through callbacks the composition root turns into log lines.

| Event                    | Level | When                                                                                                                                                                  |
| ------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat.answered`          | info  | Every question answered: `path` (`fast`/`model`), `outcome` (`answered`, `cached`, `unavailable`, `paced`, `failed`, `interrupted`), `intent`, `durationMs`, `client` |
| `chat.rate_limited`      | warn  | A request turned away with 429                                                                                                                                        |
| `assistant.failed`       | error | The model, or the stream behind an answer, threw                                                                                                                      |
| `model.circuit_opened`   | warn  | The circuit breaker opened (and again each time a trial call fails)                                                                                                   |
| `model.circuit_closed`   | info  | A trial call succeeded and the model is back                                                                                                                          |
| `model.budget_exhausted` | warn  | The instance spent its daily token budget                                                                                                                             |
| `request.failed`         | error | Any uncaught server error (`src/instrumentation.ts`), with the `digest` the error page shows                                                                          |

The visitor's question and IP address are never logged. `client` is an HMAC of
the address under a key generated in memory per instance: it follows one
visitor across lines of that instance, but cannot be reversed by hashing every
IPv4 address, which an unkeyed hash could.

`GET /api/health` answers `Cache-Control: no-store` JSON:

```json
{
  "status": "ok",
  "version": null,
  "commit": "fa1eade",
  "environment": "production",
  "model": "enabled",
  "circuit": "closed"
}
```

`model` says only whether `OPENAI_API_KEY` is configured, never its value, and
`circuit` is `closed`, `open` or `half-open` (`null` without a model). `status`
stays `ok` while the circuit is open, because the site still answers from the
fast path.

`commit` is the source of truth for which build is live: Vercel sets
`VERCEL_GIT_COMMIT_SHA` on every git deployment. The release tag cannot be
known at build time — semantic-release cuts it in CI after the gates pass,
while Vercel is already building the same commit, and Vercel exposes no tag
variable. `version` is therefore `RELEASE_VERSION` when a deployment sets one
and `null` otherwise; the tag for a commit is on the Releases page.

`src/app/error.tsx`, `global-error.tsx` and `not-found.tsx` say what failed
and what to do — try again, or go home — and show the error's digest, which
matches the `request.failed` line.

## Versioning

Versions are derived from commit history by semantic-release, which runs on
`main` only after the `ci` job has passed — a broken `main` is never tagged.
`fix:` moves the patch, `feat:` the minor, and a `BREAKING CHANGE:` footer the
major.

A release is a git tag plus a GitHub Release with generated notes. There is no
`CHANGELOG.md` and nothing is committed back to `main`: the Releases page
already renders that history linked to its commits, and writing a file back
would mean a bot commit on every release — one that would have to be exempted
from this project's own commit rules to get through.

`version` in `package.json` stays at `0.0.0-semantically-released` on purpose.
Nothing reads it, the site is not published to a registry, and a number
sitting in a file is a number somebody eventually edits. **Never bump it by
hand.**

## Conventions

Branches `por-<nn>-<slug>`, Conventional Commits carrying the task key, one
pull request per task.
