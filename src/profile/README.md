# The profile

Everything that makes this site about one person lives in this folder. To make
the site yours, edit these files and nothing outside them. The rest of the code
reads the profile only through the roots that bind it (`src/composition-root.ts`
for the API and `src/site-root.ts` for the pages), so it works for any profile
that validates.

## What to edit

| File                          | What it holds                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity.ts`                 | Your name, initials, email, LinkedIn and GitHub, the domain, and the name the site gives itself in a User-Agent                                                              |
| `locales.ts`                  | The languages the site is published in                                                                                                                                       |
| `brand.ts`                    | Your colours, one per design token, and the face the share image and tab icon are set in                                                                                     |
| `fonts.ts`                    | The faces the pages are set in, loaded with `next/font`                                                                                                                      |
| `knowledge/`                  | Your record: profile, experience, metrics, projects, skills, education, practice and how each source is cited                                                                |
| `knowledge/knowledge-base.md` | Your long-form notes; `notes.json` beside it is generated from it                                                                                                            |
| `copy/`                       | What the site writes around your facts, per language: `copy/en/answers/` holds the fast path's answers, the topic pages and your own words for some questions (`vocabulary`) |
| `evaluation/`                 | The conversations `pnpm eval:assistant` holds the assistant to                                                                                                               |
| `generated/`                  | Generated files: the retrieval index. Never edit them by hand                                                                                                                |
| `profile.test.ts`             | Tests of what your record says; the only tests that may name you                                                                                                             |
| `schema.ts`, `index.ts`       | The profile's shape and its validation. You should not need to change them                                                                                                   |

Every visitor-facing text is written per language, as `{ en: '…' }`. Ids,
dates, metric values, links and names are written once. Every fact carries the
`source` id it is cited by, and `knowledge/sources.ts` labels each one.

`identity.nonIdentifyingTerms` lists names in your record that are ordinary
words rather than yours, such as a "Freelance" employer, so the check that keeps
your name, employers and products out of the rest of the code lets them appear
there.

The answers name companies, periods, metrics and team sizes through
`copy/en/answers/facts.ts`, which reads them from `knowledge/`: change a fact
there and every answer that mentions it follows.

Not everything is here yet: the interface copy and the page metadata still
live in `src/ui` and `src/site` until POR-63 moves them into this folder. Until
then the stylesheet's colour tokens are also written in `src/ui/globals.css`,
and a test keeps them equal to `brand.ts`.

## After editing

1. `pnpm notes:build`, if you changed `knowledge/knowledge-base.md`.
2. `pnpm rag:build`, to rebuild the retrieval index (needs `OPENAI_API_KEY` in
   `.env.local`). The tests fail while the index does not match the record.
3. `pnpm test`. An invalid profile fails here, with the path of every problem,
   and so do the build and every script.
