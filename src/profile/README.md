# The profile

Everything that makes this site about one person lives in this folder. To make
the site yours, edit these files and nothing outside them. The rest of the code
reads the profile only through the roots that bind it (`src/composition-root.ts`
and, for now, the helpers in `src/app`), so it works for any profile that
validates.

## What to edit

| File                          | What it holds                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `identity.ts`                 | Your name, initials, email, LinkedIn and GitHub, the domain, and the name the site gives itself in a User-Agent |
| `locales.ts`                  | The languages the site is published in                                                                          |
| `knowledge/`                  | Your record: profile, experience, metrics, projects, skills, education, practice and how each source is cited   |
| `knowledge/knowledge-base.md` | Your long-form notes; `notes.json` beside it is generated from it                                               |
| `evaluation/`                 | The conversations `pnpm eval:assistant` holds the assistant to                                                  |
| `generated/`                  | Generated files: the retrieval index. Never edit them by hand                                                   |
| `profile.test.ts`             | Tests of what your record says; the only tests that may name you                                                |
| `schema.ts`, `index.ts`       | The profile's shape and its validation. You should not need to change them                                      |

Every visitor-facing text is written per language, as `{ en: '…' }`. Ids,
dates, metric values, links and names are written once.

## After editing

1. `pnpm notes:build`, if you changed `knowledge/knowledge-base.md`.
2. `pnpm rag:build`, to rebuild the retrieval index (needs `OPENAI_API_KEY` in
   `.env.local`). The tests fail while the index does not match the record.
3. `pnpm test`. An invalid profile fails here, with the path of every problem,
   and so do the build and every script.
