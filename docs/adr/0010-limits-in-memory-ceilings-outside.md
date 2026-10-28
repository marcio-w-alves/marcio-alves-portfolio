# 0010 — Limits in memory per instance; the hard ceilings live outside the code

**Status:** Accepted

## Context

A public endpoint that calls a paid model needs limits. A shared store (Redis
or similar) would make them global, at the cost of another service to run and
another dependency in every request.

## Decision

The limits are in memory, per server instance: 40 requests per IP per ten
minutes (429 with `Retry-After`), 15 model answers per visitor per ten
minutes, two million tokens per instance per day, a one-hour cache of answers
to history-free questions, a 32 KB body cap, and a circuit breaker on the
model. They are defence in depth. The hard ceilings are outside the code: the
provider's spending limit, and the platform's firewall if traffic ever needs
it.

## Consequences

- No extra service, and the limits are unit-tested like any other code.
- Limits are per instance, so a visitor spread across instances gets more;
  the provider's cap still bounds the cost.
- Browser tests start a fresh server per run, because the limiter remembers
  the previous run's requests.
