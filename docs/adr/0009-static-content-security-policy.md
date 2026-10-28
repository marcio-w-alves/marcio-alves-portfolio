# 0009 — A static Content-Security-Policy, without nonces

**Status:** Accepted

## Context

The site should load nothing from anywhere else. The strictest policies use
per-request nonces for scripts, but Next's guide notes that nonces do not work
with partial prerendering, which this app uses (`cacheComponents`).

## Decision

A static policy on every route: every source is this origin only, objects are
blocked, the site cannot be framed, and forms post only here. Scripts allow
`'unsafe-inline'` for Next's inline bootstrap; style elements are refused,
while inline style attributes are allowed (`style-src-attr`), because a
server-rendered CSS variable is how components pass a dynamic value. The
development server, which needs inline styles and eval, gets a looser policy.
HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and
`X-Frame-Options` come with it. Browser tests check the headers, that an
answer streams and the sharing image loads with no violation, and that a
foreign script and a cross-origin frame are refused.

## Consequences

- No third-party script can run, and the page cannot be embedded.
- `'unsafe-inline'` for scripts is the known gap; it closes if nonces become
  compatible with prerendering.
- Vercel's preview toolbar is blocked on preview deployments.
