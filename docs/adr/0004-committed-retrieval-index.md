# 0004 — The retrieval index is built offline and committed

**Status:** Accepted

## Context

Semantic search over the record needs embeddings. Computing them at build or
start-up would make every deployment depend on the provider being reachable,
and would spend money on every build.

## Decision

`pnpm rag:build` embeds the corpus (`text-embedding-3-small`, 512 dimensions)
and writes `src/infrastructure/retrieval/knowledge-index.json`, which is
committed. A test hashes the corpus and fails when the record changed but the
index was not rebuilt. Search keeps passages above a calibrated relevance
floor, so an off-topic query returns nothing rather than the least-bad match.

## Consequences

- Builds and deployments never call the embeddings API.
- Changing the record is a two-step change — edit, then `pnpm rag:build` —
  and CI refuses the first step alone.
- The index is a generated file in the repository; formatting skips it.
