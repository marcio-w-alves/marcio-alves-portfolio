# 0008 — No persistent Turbopack cache

**Status:** Accepted

## Context

Since Next 16.3, Turbopack keeps a persistent cache between builds by default,
and Vercel restores it on every deployment. After the redesign, production
shipped without the classes it had added: the sidebar stacked above the page
and the hero lost its size, while a clean local build was correct. The
Tailwind loader does not declare that its output depends on the class names
in every component, so a build where only components changed reused the
previous stylesheet. The development server showed the same symptom.

## Decision

`turbopackFileSystemCacheForBuild` and `turbopackFileSystemCacheForDev` are
off. A stale stylesheet was first caught by comparing the deployed home page
with the design.

## Consequences

- Builds and dev start-ups are slower; the stylesheet is always the one the
  code describes.
- Worth revisiting when the loader declares its dependencies — the live check
  will say whether turning the cache back on is safe.
