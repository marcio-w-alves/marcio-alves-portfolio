# 0003 — The model never holds the record; it acts through an allow-list

**Status:** Accepted

## Context

A model given a document about a person will happily embroider it. The
requirement is the opposite: every claim about Marcio comes from the record,
and anything else is declined.

## Decision

The model receives no knowledge base in its prompt. It can only call named
actions — the experience, metrics, skills, projects, education, contact
channels, a semantic search over the record, encyclopedia briefs for the
technologies and companies in it, his public GitHub — each with a strict Zod
input schema that rejects unknown keys. Display actions return the content of
the card they show, so the model describes what the visitor sees. A
`declineToAnswer` action marks an answer as a refusal, and a refusal cites no
sources. Action results are data, never instructions.

The system prompt states the grounding rules; the code enforces the parts a
prompt cannot: only allow-listed actions run, their arguments are validated,
and the loop is bounded (four rounds, six actions per round, 700 tokens per
round, the last round forced to write).

## Consequences

- What the model can know is exactly what the actions return, which is what
  the evaluation grades against (ADR 0005).
- A question no action covers ends as "not documented" rather than a guess.
- Each new capability is a new action with a contract and tests, not a line
  in a prompt.
