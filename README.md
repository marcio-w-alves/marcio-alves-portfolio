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

| Command             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Development server                            |
| `pnpm build`        | Production build                              |
| `pnpm typecheck`    | Route types, then TypeScript, no emit         |
| `pnpm lint`         | ESLint, warnings treated as failures          |
| `pnpm lint:fix`     | ESLint with autofix                           |
| `pnpm format`       | Prettier, write                               |
| `pnpm format:check` | Prettier, verify only                         |
| `pnpm boundaries`   | Module-boundary rules                         |
| `pnpm test`         | Unit and integration tests (Vitest)           |
| `pnpm rag:build`    | Re-embed the knowledge corpus (needs the key) |
| `pnpm verify`       | Every gate, in the order CI runs them         |

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

## Design tokens

`src/app/globals.css` is the whole visual vocabulary, declared as Tailwind v4
`@theme` variables: surfaces, ink, lines, accent, radii, shadows, one easing
curve, two durations, four keyframes, and the two layout widths. Every visual
decision is therefore expressible as a utility over a token — `bg-surface`,
`text-ink-muted`, `shadow-composer`, `duration-fast`.

The corollary matters more than the list: **a value that cannot be written as
a utility is a missing token, not a licence to write CSS.** The only raw CSS in
the project is what no utility can reach — the global focus ring, two
text-rendering hints, and the `prefers-reduced-motion` collapse.

`--color-ink-faint` is for icons, rules and decoration. It does not reach WCAG
AA as body text, which is what `--color-ink-muted` exists for: the design
prototype darkened the brief's `#767b77` to `#686d69` for exactly that reason,
and the corrected value is the one that ships. Where contrast and fidelity
disagree, contrast wins.

Both Geist faces are self-hosted through the `geist` package, so no build or
page load depends on Google Fonts.

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
