# 0005 — Answers are graded against the evidence they had

**Status:** Accepted

## Context

Unit tests prove the code does what it was written to do. They do not prove
the assistant stays truthful, which is the product's whole promise.

## Decision

`pnpm eval:assistant` runs a corpus of conversations — career, technologies,
companies, profiles, location, undocumented details, off-topic requests,
injection attempts, follow-ups, other languages — through the production
wiring. An independent judge, a stronger model than the one answering, gets
each answer's prose and the exact evidence behind it: the actions the model
ran and what they returned, or the knowledge base for the fast path. It must
back every claim with a passage it copies from that evidence; the script
checks the passage is really there, and a claim without one is re-checked
once with only the evidence in view. Before grading, the judge is calibrated
on answers with planted fabrications, and the run aborts if it misses one.

It runs locally, with a key, not in CI.

## Consequences

- "Grounded" is measured, not asserted. Every failure the evaluation reported
  so far has been a real defect in routing, prompting or copy — or a judge
  rule that needed sharpening, which calibration then guards.
- It costs tokens and minutes per run, so it runs when answers, prompts or
  the record change, not on every commit.
