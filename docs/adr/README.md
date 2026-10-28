# Architecture decision records

Each record states a decision, the context that forced it, and what it costs.
A decision that changes gets a new record that supersedes the old one; records
are not rewritten.

| #                                                      | Decision                                                               | Status   |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | -------- |
| [0001](0001-framework-free-core.md)                    | The core is framework-free, and the build checks it                    | Accepted |
| [0002](0002-two-paths-to-an-answer.md)                 | Two paths to an answer: a deterministic router first, the model second | Accepted |
| [0003](0003-the-model-never-holds-the-record.md)       | The model never holds the record; it acts through an allow-list        | Accepted |
| [0004](0004-committed-retrieval-index.md)              | The retrieval index is built offline and committed                     | Accepted |
| [0005](0005-grading-answers-against-their-evidence.md) | Answers are graded against the evidence they had                       | Accepted |
| [0006](0006-design-fidelity-by-pixels.md)              | Design fidelity is proven by pixels                                    | Retired  |
| [0007](0007-contrast-over-decoration.md)               | Text contrast is a token rule, decoration has its own ink              | Accepted |
| [0008](0008-no-persistent-build-cache.md)              | No persistent Turbopack cache                                          | Accepted |
| [0009](0009-static-content-security-policy.md)         | A static Content-Security-Policy, without nonces                       | Accepted |
| [0010](0010-limits-in-memory-ceilings-outside.md)      | Limits in memory per instance; the hard ceilings live outside the code | Accepted |
