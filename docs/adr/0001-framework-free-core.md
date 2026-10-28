# 0001 — The core is framework-free, and the build checks it

**Status:** Accepted

## Context

A portfolio's code is read by people judging how its author designs software.
The interesting part here — what the assistant may say, and how — is policy,
and policy should not depend on a web framework, a model vendor or a UI
library that will change underneath it.

## Decision

`src/core` holds the domain and policy in plain TypeScript: the knowledge
base, the conversation's transitions, both answer paths, the tool contracts
and the ports they need. Zod is the one dependency allowed, because tool
contracts are Zod schemas and those schemas are policy. Everything outward —
Next.js routes, the OpenAI SDK, retrieval, Wikipedia, GitHub, logging — is an
adapter in `src/app` or `src/infrastructure`, bound to its port in
`src/composition-root.ts` and nowhere else.

dependency-cruiser enforces the direction on every commit and in CI: the core
may not import a package other than Zod, nor reach the app, the UI, the
adapters, `env` or the composition root; inside the core, the knowledge base
never imports the assistant.

## Consequences

- The core is tested without a server, a browser or a network.
- A new outward need is a port first; nothing in the core can take a shortcut.
- Some data crosses a boundary twice (for example the contact details the UI
  shows and the tools return), which is the price of keeping both sides plain.
