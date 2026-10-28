# 0007 — Text contrast is a token rule, decoration has its own ink

**Status:** Accepted

## Context

A design's palette usually has a light grey that looks right for secondary
text and fails WCAG AA. The first design's prototype darkened its grey for
text for that reason; the revision kept the distinction with new values.

## Decision

The palette has two greys with separate jobs. `ink-muted` (#5b616b) is for
text and holds 5.5:1 or better on every surface. `ink-faint` (#a3a9b1) is for
icons, rules and decoration only, and is never used for text. Where contrast
and fidelity disagree, contrast wins; so far the design has never asked for
the trade.

Automated axe scans of the key states (welcome, a rich answer, a failed
answer, the phone drawer) run in CI at WCAG 2.1 AA, and Lighthouse requires an
accessibility score of 1.

## Consequences

- A component picks a grey by role, not by eye, and review can check it.
- The automated scans are a floor, not proof: keyboard paths, focus and
  screen-reader names are covered by component and browser tests too.
