# 0006 — Design fidelity is proven by pixels

**Status:** Retired (POR-75). The UI was built and verified against the design; the
references, the workbench pages and `pnpm fidelity` were then removed, and
changes are checked in the browser and by the end-to-end tests.

## Context

The interface must follow an approved design exactly. "Looks close" is an
opinion; a reviewer cannot see a 2px drift or a wrong grey.

## Decision

`pnpm fidelity:references` renders every artboard of the design, served
locally with its own runtime, at its canvas size. `pnpm fidelity` renders each
board's counterpart — a development-only page built from the real components
and the real record — at the same size, and compares them pixel by pixel with
anti-aliasing left out. Every board must match on at least 99.9% of its
pixels. Full-screen states are rebuilt the way the prototype builds them, by
replaying real fast-path answers through the conversation's transitions.
`pnpm fidelity:live` checks the production home page the same way.

The references take three documented liberties with the prototype: no
"Preview with scripted answers" notice, the production contact data, and two
timing artefacts undone.

## Consequences

- When the design was revised, the gate showed exactly how far the code was
  from it, board by board, and when it was done.
- The live check caught a deployment that differed from the local build
  (ADR 0008).
- It runs locally, not in CI: fonts rasterise differently on CI runners.
- When the product deliberately leaves the design, the board says so: a
  `departure` with its reason keeps it measured and reported, without failing
  the gate. Topic pages (POR-34) are the first.
