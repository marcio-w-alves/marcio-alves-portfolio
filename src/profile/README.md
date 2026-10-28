# The profile

Everything that makes this site about one person lives in this folder. To make
the site yours, edit these files and nothing outside them. The rest of the code
reads the profile only through the roots that bind it (`src/composition-root.ts`
for the API and `src/site-root.ts` for the pages), so it works for any profile
that validates.

## What to edit

| File                          | What it holds                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity.ts`                 | Your name, initials, email, LinkedIn and GitHub, the domain, and the name the site gives itself in a User-Agent                                                                                                                                                                                                                                |
| `locales.ts`                  | The languages the site is published in. Add one only once its copy and every text of the record are written in it; validation lists what is missing. `PREVIEW_LOCALES=pt-BR pnpm build` tries one out first                                                                                                                                    |
| `brand.ts`                    | Your colours, one per design token, your font families' fallbacks, and the face the share image and tab icon are set in                                                                                                                                                                                                                        |
| `fonts.ts`                    | The faces the pages are set in, loaded with `next/font`                                                                                                                                                                                                                                                                                        |
| `knowledge/`                  | Your record: profile, experience, metrics, projects, skills, education, practice and how each source is cited                                                                                                                                                                                                                                  |
| `knowledge/knowledge-base.md` | Your long-form notes; `notes.json` beside it is generated from it                                                                                                                                                                                                                                                                              |
| `sites/`                      | `allow-list.ts`: the public pages of your products and companies the assistant may read; `snapshot.json` beside it is generated from them by `pnpm sites:ingest`                                                                                                                                                                               |
| `copy/`                       | What the site writes around your facts, per language (`copy/en/`, `copy/pt-BR/`): `answers/` holds the fast path's answers, the topic pages and your own words for some questions (`vocabulary`); `ui.ts` and `site.ts` reword the interface and the pages' titles where yours differs from the default; `about.ts` is the page about the site |
| `evaluation/`                 | The conversations `pnpm eval:assistant` holds the assistant to                                                                                                                                                                                                                                                                                 |
| `global-error-copy.ts`        | What the page shown when the whole layout fails may know of you: your name, for the tab's title                                                                                                                                                                                                                                                |
| `generated/`                  | Generated files: the retrieval index and `brand.css`, the stylesheet's colour and font tokens. Never edit them by hand                                                                                                                                                                                                                         |
| `profile.test.ts`             | Tests of what your record says; the only tests that may name you. `translations.test.ts` beside it holds each translation to its English: every text written, no figure added, no English left                                                                                                                                                 |
| `schema.ts`, `index.ts`       | The profile's shape and its validation. You should not need to change them                                                                                                                                                                                                                                                                     |

Every visitor-facing text is written per language, as
`{ en: '…', 'pt-BR': '…' }`. Ids, dates, metric values, links and names are
written once. A translation states only the numbers, dates and links its English
text does; validation rejects one that adds any. The retrieval index holds the
record in every language it is fully written in; your notes and the sites'
passages stay in the language they are written in. Every fact carries the
`source` id it is cited by, and `knowledge/sources.ts` labels each one.

`identity.nonIdentifyingTerms` lists names in your record that are ordinary
words rather than yours, such as a "Freelance" employer, so the check that keeps
your name, employers and products out of the rest of the code lets them appear
there.

The answers name companies, periods, metrics and team sizes through each
language's `answers/facts.ts`, which reads them from `knowledge/`: change a fact
there and every answer that mentions it follows.

The interface and the pages speak a default English and Portuguese written for
anyone's portfolio (`src/ui/i18n/en.ts`, `src/ui/i18n/pt-BR.ts` and
`src/site/site-copy.ts`). Override only what you would word differently in each
language's `ui.ts` and `site.ts`; TypeScript
rejects a key the defaults do not have. `{firstName}`, `{name}` and `{title}` in
any message are filled from your record.

## After editing

1. `pnpm brand:css`, if you changed `brand.ts`. The tests fail while the
   stylesheet's tokens do not match it.
2. `pnpm notes:build`, if you changed `knowledge/knowledge-base.md`.
   `pnpm sites:ingest`, if you changed `sites/allow-list.ts` or a site changed
   (`pnpm sites:ingest --check` lists the pages read more than 180 days ago).
   It reads only the listed pages, obeys their robots.txt, and reports any it
   could not read. A site's text describes the product, never your part in it:
   the assistant is told so, and a project shows technologies only where
   `technologiesSource` names the record or the site page that states them.
3. `pnpm rag:build`, to rebuild the retrieval index (needs `OPENAI_API_KEY` in
   `.env.local`). The tests fail while the index does not match the record.
4. `pnpm test`. An invalid profile fails here, with the path of every problem,
   and so do the build and every script.
