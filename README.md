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

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Development server               |
| `pnpm build`     | Production build                 |
| `pnpm typecheck` | TypeScript, no emit              |
| `pnpm lint`      | ESLint                           |

## Architecture

Source dependencies point inward. `src/core` is plain TypeScript: it never
imports from Next.js, React, the OpenAI SDK or any other outer layer.

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

## Conventions

Branches `por-<nn>-<slug>`, Conventional Commits carrying the task key, one
pull request per task. Versioning is automated from commit history on `main`;
never bump `version` by hand.
