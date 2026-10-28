# 0002 — Two paths to an answer: a deterministic router first, the model second

**Status:** Accepted

## Context

Most visitors ask the questions the interface suggests. Sending each of them
to a model costs money and latency for an answer that is known in advance,
and every model call is a chance to drift from the record.

## Decision

**System 1** is a deterministic router over the question. What it recognises
with confidence — every suggested question and follow-up, the refusals,
technologies weighed against the record — it answers from the knowledge base
at once, with no model call. What it is unsure of, it escalates: low
confidence, definitions, comparisons, several companies at once, long or
compound questions, narrow details such as grades or exact figures, anything
not written in English, and requests to do something rather than to learn
about Marcio.

**System 2** answers the rest with `gpt-4o-mini`, acting only through the
allow-listed actions (ADR 0003). Both paths emit the same event stream, so the
interface cannot tell them apart.

A test walks the whole suggestion graph and requires the fast path to answer
every question the interface can offer.

## Consequences

- The suggested questions cost nothing and answer in milliseconds.
- Without a model key the site still answers everything System 1 recognises,
  and says plainly what it cannot.
- The router's patterns need care: a too-eager match answers a different
  question than the one asked. The evaluation (ADR 0005) found several, which
  is why ambiguous shapes escalate rather than guess.
