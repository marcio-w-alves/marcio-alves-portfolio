# PRD — Bilingual, whitelabel portfolio and review remediation (`i18n-whitelabel`)

Status: draft for approval · Tickets: POR-41 → POR-70 (POR-71 spare) · Author: feature planner · Date: 2026-10-28 · Rev. 2 (rebased on `main` c913837; aligned with `design.md`)

## 1. Overview

The portfolio (live at `https://marciomariani.dev`) is a Next.js site with an AI assistant that answers
questions about Marcio's work, grounded in a typed knowledge base. Today it is English-only, its owner's
data is scattered across `src/core`, `src/app` and `src/ui` (career facts are even repeated as literals in
the fast-path answers), `src/app` mixes routes with loose helper files, and a code/content review done
on 2026-10-28 found bugs, robustness gaps, content problems a recruiter would notice, and test/CI gaps.

This initiative makes the site **bilingual (English + Brazilian Portuguese)**, turns it into a
**whitelabel** template whose every owner-specific value lives in **one profile folder**, reorganises
the code so reuse is structural rather than accidental, and **fixes every finding of the review**
(except the "three names" finding, which the owner dropped). It is for two audiences: hiring managers
and engineers who visit the site or open the repository, and a developer who forks it to run their own
portfolio. It is scheduled now because the review is fresh and the next content pass (Portuguese
résumé, product sites) would otherwise have to touch the same scattered literals twice.

## 2. Goals and non-goals

### Goals

- G1. Every visitor-facing string — interface, topic pages, fast-path answers, knowledge base, metadata,
  share image, résumé PDF — exists in English and Portuguese, selected by the URL.
- G2. A fork can become someone else's portfolio by editing one profile folder (content + brand) and
  nothing else, verified by a test.
- G3. `src/app` contains routes only; shared code lives in named modules; contracts shared by client
  and server have one definition.
- G4. All confirmed bugs fixed, each with a regression test that fails without the fix.
- G5. The record a recruiter reads is accurate and complete: headline, availability, current job first,
  no typos, overlapping roles explained, projects with real substance.
- G6. The assistant's free-form answers are as grounded and relevant as the fast path's, measured by
  the local evaluation.
- G7. The server survives abusive or long-lived traffic without unbounded memory, budget theft or hung
  streams.
- G8. The README presents the project to a hiring manager or engineer.

### Non-goals (explicitly out of scope)

- NG1. The "three names" issue (Marcio Alves / marciomariani.dev / `linkedin.com/in/marcio-montenegro`).
  Names, domain and profile URLs stay exactly as they are.
- NG2. Languages other than English and pt-BR; translated URL slugs (`/pt/experiencia`); right-to-left
  support.
- NG3. Locale auto-detection, redirects, "view in Portuguese?" suggestions, or a remembered locale
  cookie. The URL alone decides.
- NG4. Multiple profiles selected at runtime or by environment variable; a CMS; an admin UI.
- NG5. Changing the set of seven topics per profile (the topics are fixed; their copy and questions are
  profile content).
- NG6. Running `pnpm eval:assistant` in CI (owner decision: it stays local).
- NG7. New Figma/HTML design artboards for Portuguese or for the new elements; Portuguese pages are not
  pixel-gated.
- NG8. Request-time crawling of external sites; ingesting anything not on an explicit allow-list.
- NG9. Translating `/workbench`, the fidelity specimens, `/api` error payloads meant for machines, logs,
  or tool contracts.
- NG10. Persisting conversations beyond the browser tab (unchanged from today).
- NG11. Showing the phone number on the website or letting the assistant disclose it (it appears only in
  the generated résumé PDF, as in the hand-made PDF today).

## 3. Assumptions and decisions

| #   | Topic                     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Source                       |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| D1  | Locales                   | `en` (default) and `pt-BR`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Owner                        |
| D2  | URL scheme                | English unprefixed (`/`, `/experience`, …); Portuguese under `/pt` with the same slugs (`/pt`, `/pt/experience`, …). Unknown paths 404 in both.                                                                                                                                                                                                                                                                                                                                                                     | Owner (Q1)                   |
| D3  | Default locale            | No redirect, no suggestion, no cookie. `/` is always English.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Owner (Q2)                   |
| D4  | Answer language           | The language the question is written in wins. The fast path recognises EN and PT questions on every page; when the language is ambiguous (e.g. "React?"), the page locale decides. Other languages go to the model as today.                                                                                                                                                                                                                                                                                        | Owner (Q3)                   |
| D5  | Conversations on switch   | Kept per locale **and** per page, in the tab; switching opens the counterpart page in its own state; switching back finds the earlier conversation intact. Nothing is translated retroactively.                                                                                                                                                                                                                                                                                                                     | Owner (Q4)                   |
| D6  | Translation authorship    | Implementer drafts PT from the EN source with no added fact; PRs merge on green CI; owner reviews on the live site afterwards.                                                                                                                                                                                                                                                                                                                                                                                      | Owner (Q5)                   |
| D7  | SEO                       | Per-locale title, description, canonical, `hreflang` alternates (`en`, `pt-BR`, `x-default`→EN), sitemap entries for both, JSON-LD `Person` per locale, per-locale share image.                                                                                                                                                                                                                                                                                                                                     | Owner (Q6)                   |
| D8  | Switcher                  | "EN · PT" link control at the sidebar foot and in the phone drawer; real links to the counterpart page; active locale indicated.                                                                                                                                                                                                                                                                                                                                                                                    | Owner (Q7)                   |
| D9  | Profile folder            | One folder holds all owner content (both languages), interface copy, topic copy and questions, fast-path prose, assistant identity, links, domain, résumé data, share-image text, colours and fonts. The seven topic ids are fixed.                                                                                                                                                                                                                                                                                 | Owner (Q8)                   |
| D10 | Résumé PDF                | Generated at build from the knowledge base, EN and PT; replaces `public/marcio-alves-resume.pdf`. Toptal first; typos gone; phone number included (owner decision).                                                                                                                                                                                                                                                                                                                                                 | Owner (Q15)                  |
| D11 | Repo settings             | `gh repo edit` homepage `https://marciomariani.dev` and topics `nextjs typescript ai-assistant rag portfolio tailwindcss playwright`.                                                                                                                                                                                                                                                                                                                                                                               | Owner (Q16)                  |
| D12 | Mobile and above-the-fold | Phone welcome screen shows contact + résumé without opening the drawer; every welcome screen shows an evidence line (companies + two headline metrics) under the heading. Affected boards get recorded design departures.                                                                                                                                                                                                                                                                                           | Owner (Q17a)                 |
| D13 | Coverage                  | Thresholds on `src/core` and `src/infrastructure`, set slightly below the measured baseline (lines/branches/functions, rounded down to the nearest whole percent minus 2); README updated.                                                                                                                                                                                                                                                                                                                          | Owner (Q18)                  |
| D14 | Fidelity in CI            | Runs in a pinned Playwright container against references captured in the same container; required on PRs touching `src/ui`, `src/app`, `src/site`, `src/profile`, `scripts/fidelity` or `design/`. CI references are captured in that container from the **design export, which the orchestrator commits under `design/`** (served with its own runtime) — no owner action needed. Report-only if the container cannot hold 99.9%, with the reason recorded in the README. Local references stay.                   | Owner (Q20); coordinator     |
| D15 | Bugs                      | Each confirmed bug is its own task with a regression test; core bugs in the first wave.                                                                                                                                                                                                                                                                                                                                                                                                                             | Owner (Q22)                  |
| D16 | Availability              | "Brazil · remote · UTC−3 · open to opportunities". City stays undocumented (`null`).                                                                                                                                                                                                                                                                                                                                                                                                                                | Owner (Q9)                   |
| D17 | Headline                  | EN "Senior Frontend Engineer with tech-lead responsibilities"; PT "Senior Frontend Engineer com responsabilidade de tech lead". "Staff-level" removed from headline, title, meta, OG, welcome and overview intro. A Staff-scope argument may remain only as a fast-path answer worded as scope and grounded in the record.                                                                                                                                                                                          | Owner (Q12)                  |
| D18 | Toptal                    | Employer. The "Collaborates with the Director and CEO" line becomes a concrete responsibility drawn only from the existing Toptal highlights. No metrics.                                                                                                                                                                                                                                                                                                                                                           | Owner (Q10)                  |
| D19 | Overlapping roles         | "Concurrent" badge removed everywhere; Roots, Maison Modern and Freelance carry a "Contract" tag.                                                                                                                                                                                                                                                                                                                                                                                                                   | Owner (Q11)                  |
| D20 | Project knowledge         | Build-time, allow-listed ingestion of public sites (EvCopilot, FormDaily, TargUp, and the public sites of the other products/companies in the record), chunked, embedded and committed into the retrieval index with per-passage source URL; refreshed by a script. Site text describes the **product**, never Marcio's role or results unless the record says so. A project's stack is shown only when its site or the record states it.                                                                           | Owner (Q13)                  |
| D21 | FictionDraft              | Kept, marked "Concept".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Owner (Q13b)                 |
| D22 | This portfolio            | Listed as a project: stack, repo link, live link, two outcomes the repo proves (fidelity gate pass, Lighthouse scores).                                                                                                                                                                                                                                                                                                                                                                                             | Owner (Q14)                  |
| D23 | Evaluation                | Stays local. Improvements in scope: N runs per case with a pass rate, tool-trace calibration, `avoids` on injection cases, Portuguese, leadership and product-vs-person cases.                                                                                                                                                                                                                                                                                                                                      | Owner (Q19)                  |
| D24 | README                    | Order: live link + screenshot, what/why, stack, how it's built, how it was delivered (AI-assisted plan→design→test→review pipeline, human approves plans and merges), links to `CONTRIBUTING.md`. Setup/contributor detail moves to `CONTRIBUTING.md`.                                                                                                                                                                                                                                                              | Owner (Q21)                  |
| D25 | Language register         | The welcome screen speaks as the owner in the first person; the assistant speaks about him in the third person; both in both languages. Job titles, company, product and technology names stay as written on the résumé.                                                                                                                                                                                                                                                                                            | Planner                      |
| D26 | Fidelity scope            | Only English pages are pixel-gated. **Content-only differences** (a changed title, badge text, the switcher) are excluded with **element masks**, each with a recorded reason; the masks on a board may cover at most **3% of its area**, otherwise the board fails. **Layout changes** (Main, Mobile and WelcomeScreen for the evidence line and phone contact; other boards whose layout the record corrections change, as listed in `design.md` §11.2) take a recorded **departure** naming the task and reason. | Coordinator (per design §11) |
| D27 | Formats                   | Dates and numbers use the page locale (`Mar 2026` / `mar. 2026`; `50%` / `50%`).                                                                                                                                                                                                                                                                                                                                                                                                                                    | Planner                      |
| D28 | POR-35 / ids              | POR-35 and an unrelated POR-36 are merged on `main`; no task waits for them. This plan uses the reserved block **POR-41…POR-71**; POR-37…40 belong to another session. Ordering is driven only by dependencies and file conflicts.                                                                                                                                                                                                                                                                                  | Coordinator                  |
| D29 | Index rebuilds            | `src/infrastructure/retrieval/knowledge-index.json` is one committed file whose hash test fails on drift; every task that changes corpus text rebuilds it with `pnpm rag:build` (needs the owner's local key) and these tasks run strictly in series.                                                                                                                                                                                                                                                               | Planner                      |
| D30 | Portuguese go-live        | The set of enabled locales is profile data. Routing (POR-64) and Portuguese content (POR-65) merge with only English enabled: `/pt/*` answers 404 and no switcher renders. Portuguese is switched on only at the end of POR-66, together with the bilingual fast path and the Portuguese e2e journeys, so no merge publishes half-built Portuguese.                                                                                                                                                                 | Coordinator (design §3.3)    |
| D31 | `/en` paths               | `/en` and `/en/<page>` answer **308** to the unprefixed URL; the site never emits an `/en/…` URL.                                                                                                                                                                                                                                                                                                                                                                                                                   | Coordinator (design §3.2)    |
| D32 | Résumé URLs               | English keeps `/marcio-alves-resume.pdf` (unchanged); Portuguese lives under `/pt` (`/pt/marcio-alves-curriculo.pdf`); both file names come from the profile.                                                                                                                                                                                                                                                                                                                                                       | Coordinator (design §10)     |
| D33 | Owner-agnostic tests      | Core, server (http/site) and UI tests run against a **fictional fixture profile**; tests that need the real profile assert only generic properties; e2e reads expected text from the profile. This is what lets a fork's test suite pass after editing only the profile.                                                                                                                                                                                                                                            | Coordinator (design §4.6)    |

## 4. Functional requirements

Priority: **M** = must for this initiative, **S** = should. Every FR has acceptance criteria in §7.

### A. Whitelabel profile

- **FR-1 (M)** All owner-specific data lives in one profile folder: identity (name, first name, initials,
  headline, availability), contact links, domain-independent links (résumé path), the knowledge base in
  both languages, assistant identity, welcome copy, topic intros and questions, fast-path answer prose,
  interface copy, share-image text, site metadata copy, brand colours and fonts.
- **FR-2 (M)** No file outside the profile folder contains an owner-identifying literal (name, first
  name, email, LinkedIn/GitHub URL or handle, domain, company names, metric values). A test enforces it.
- **FR-3 (M)** Brand colours and font families come from the profile; the page tokens, the share image
  and the tab icon use the same values, with no second hand-kept copy.
- **FR-4 (M)** Fast-path answers derive every fact (dates, companies, years, metrics, names) from the
  knowledge base; prose around those facts comes from profile copy. No career fact is a literal in
  `src/core/assistant`. Owner-specific intents and wording — e.g. the HRIS-lead answer, the
  Staff-scope answer, owner vocabulary such as "HRIS" or "UFPB" in the router — live in the profile;
  core intents carry generic names.
- **FR-5 (S)** The profile folder carries a short guide (in the folder) listing what a reuser edits.
- **FR-54 (M)** Core, server and UI unit/integration tests run against a fictional fixture profile (both
  locales, different name, colours, contact, roles, projects and answer copy); tests that use the real
  profile assert only generic properties (suggestion graph closes, integrity holds, index hash matches).
- **FR-55 (M)** End-to-end tests read the expected visible text (name, headline, questions, labels) from
  the profile instead of hard-coding it.

### B. Internationalisation

- **FR-6 (M)** Every page exists at its English path and at `/pt` + the same path; both are prerendered.
  Any other path answers 404 with a page in the locale of its prefix.
- **FR-7 (M)** Each page renders `<html lang>` as `en` or `pt-BR` and all visible copy in that locale,
  including topic pages, rich cards, empty/error/rate-limited states, aria labels and the 404/error pages.
- **FR-8 (M)** A language switcher ("EN · PT") appears at the sidebar foot and in the phone drawer, links
  to the counterpart of the current page, marks the active locale, and is keyboard and screen-reader
  operable.
- **FR-9 (M)** Conversations are held per locale and per page for the life of the tab (D5).
- **FR-56 (M)** Portuguese is publicly reachable (routes, switcher, sitemap, `hreflang`) only once enabled
  in the profile, which happens at the end of the bilingual fast-path task (D30); until then `/pt/*`
  answers 404 and no surface links to it.
- **FR-57 (M)** `/en` and `/en/<page>` redirect permanently (308) to the unprefixed URL (D31).
- **FR-10 (M)** The fast path recognises the suggested questions and its intents in both languages on
  every page and answers in the question's language; ambiguous-language questions use the page locale.
- **FR-11 (M)** The model path receives the page locale and replies in the question's language, using the
  page locale only to break ties.
- **FR-12 (M)** Every suggested question and every follow-up offered by any answer, in both languages, is
  answered by the fast path (the suggestion-graph guarantee holds per locale).
- **FR-13 (M)** The knowledge base exists in English and Portuguese with identical ids, dates, metric
  values and links; only text differs.
- **FR-14 (M)** Retrieval searches passages of both languages and cites the same sources.
- **FR-15 (M)** Per-locale metadata, `hreflang` alternates with `x-default`, sitemap entries for both
  locales, JSON-LD `Person` per locale, and a per-locale 1200×630 share image (D7).
- **FR-16 (M)** Dates and numbers are formatted in the page locale (D27).

### C. Record and presentation corrections

- **FR-17 (M)** Headline, home title, meta description, OG/Twitter text, welcome description and overview
  intro use the D17 headline; "Staff-level" appears in none of them in either language.
- **FR-18 (M)** Profile shows availability "Brazil · remote · UTC−3 · open to opportunities" (PT
  equivalent) on the contact card and in the assistant's contact/location answers; city stays
  undocumented.
- **FR-19 (M)** The Toptal role keeps no metrics and replaces "Collaborates with the Director and CEO"
  with a concrete responsibility drawn from the existing Toptal highlights (D18).
- **FR-20 (M)** No "Concurrent" badge anywhere; Roots, Maison Modern and Freelance show "Contract" /
  "Contrato" (D19).
- **FR-21 (M)** The portfolio itself is listed as a project (D22); FictionDraft stays, marked "Concept".
- **FR-22 (M)** On a 390×844 phone, the welcome screen shows contact and résumé actions without opening
  the drawer.
- **FR-23 (M)** Every welcome screen shows, under the heading, an evidence line naming the companies and
  two headline metrics, all read from the knowledge base (the profile flags which two).
- **FR-24 (M)** The GitHub repository's homepage is `https://marciomariani.dev` and it carries the D11
  topics.

### D. Product-site knowledge

- **FR-25 (M)** A script fetches an allow-list of public product/company sites, extracts their text,
  chunks and embeds it, and commits it into the retrieval index; each passage records its source URL and
  fetch date. Nothing is fetched at request time or at build.
- **FR-26 (M)** The assistant presents site-derived passages as facts about the **product** and never as
  Marcio's role, contribution or results unless the record states them; sources for such passages show
  the site URL.
- **FR-27 (M)** A project card shows technologies only when the record or the product's site states them;
  otherwise the technologies row is absent (not empty).

### E. Résumé PDF

- **FR-28 (M)** The résumé PDF is generated at build from the knowledge base in English and Portuguese,
  roles newest first (Toptal first). The English PDF keeps its current URL; the Portuguese one lives under
  `/pt` (D32); the PT site links the PT PDF.
- **FR-29 (M)** The generated PDF contains the phone number (profile field used only by the PDF) and no
  fact absent from the knowledge base; the review's typos ("teams.Strong", "Ci/Cd", "Ux/Ui", "Seo
  Optimization", "Da Paraíba") are absent.

### F. Assistant correctness and quality

- **FR-30 (M)** The offer filter removes only closing offers of help and never a sentence that carries a
  fact (e.g. "If you ask about performance, he cut load time by 50%." survives).
- **FR-31 (M)** The router answers or escalates — never refuses — "Did he act as a tech lead at Deel?",
  questions about "codebase health", "password reset flows" and "React children".
- **FR-32 (M)** A request whose context carries an unknown or prototype-named intent (e.g.
  `lastIntent: "constructor"`) is rejected at the boundary or treated as no context; it never throws.
- **FR-33 (M)** Retrying or editing an older answer while another answer streams cancels the in-flight
  answer; no answer is left in a streaming state.
- **FR-34 (M)** Model answers render links only to URLs that came from action results or the knowledge
  base; any other link is rendered as plain text.
- **FR-35 (M)** Model answers to leadership/impact questions (in either language) cite the leadership
  facts of the record (Deel HRIS team lead, Roots team growth) and list as sources only records whose
  evidence the answer used.

### G. Robustness

- **FR-36 (M)** Rate-limit and budget maps evict entries whose window has passed, so memory is bounded by
  active clients, not by all clients ever seen.
- **FR-37 (M)** Client keys normalise IPv6 addresses to their /64 prefix (IPv4 unchanged).
- **FR-38 (M)** Tokens consumed by an answer that is interrupted (visitor leaves, error, timeout) are
  counted against the daily model budget.
- **FR-39 (M)** The embeddings call has a timeout, honours the request's abort signal and sits behind a
  circuit breaker; an exception thrown by any tool's execution becomes a tool error the model sees, not a
  failed request.
- **FR-40 (M)** GitHub and Wikipedia adapters validate the JSON they receive and log every failure (with
  status and cause) before degrading.
- **FR-41 (M)** The chat stream sends a heartbeat at least every 15 s while waiting, and every request has
  an overall time limit (default 60 s, configurable) after which it ends with the interrupted event. The
  chat route's platform `maxDuration` is set above that limit (75 s), so the platform never ends the
  function first.

### H. Architecture and organisation (behaviour-preserving)

- **FR-42 (M)** `src/app` contains only Next.js route segments and special files; helpers (metadata
  builders, topic routing, workspace props, structured data, fonts, image fonts, brand colours) live in
  named modules outside it; the six topic pages share one implementation.
- **FR-43 (M)** Boundary rules forbid: `ui` → `infrastructure`/`composition-root`/`env`; `infrastructure`
  → `app`/`ui`; `app` → `infrastructure` (except through the composition root); the rule that names a
  nonexistent `components` folder is corrected; server-only modules are guarded so importing them from a
  client component fails the build.
- **FR-44 (M)** No package-level cycle between `core/knowledge` and `core/assistant`.
- **FR-45 (M)** The client bundle does not contain the knowledge base: topic intros and records are built
  on the server and passed to the client as data; no client module imports the knowledge base.
- **FR-46 (M)** Contracts used by both client and server — history turn, the interrupted error event, the
  event type list, the request schema, the question length limit — have exactly one definition, and the
  question length limit lives with the request policy.
- **FR-47 (S)** Code-health fixes with no behaviour change: the model-assistant `answer()` split into
  single-purpose steps; the `ChatWorkspace` mapping extracted; one copy-confirmation timer shared by its
  two users; the conversation-store context value stable across renders; the temperature comment agrees
  with the value; next-intent and topic-default tables keyed by their union types; company patterns
  defined once.

### I. Tests and CI

- **FR-48 (M)** The SSE parser handles CRLF line endings, a final frame without a trailing blank line, a
  multi-byte UTF-8 character split across chunks, and multi-line `data:` fields (joined with `\n`).
- **FR-49 (M)** Motion e2e checks wait for conditions, not single-shot timings.
- **FR-50 (M)** Coverage thresholds on `src/core` and `src/infrastructure` per D13, enforced in CI.
- **FR-51 (M)** `pnpm fidelity` runs in CI per D14.
- **FR-52 (M)** The local evaluation runs each case N times (default 3) and reports a per-case pass rate
  (pass ≥ 2/3); calibration includes the tool trace; injection cases have `avoids`; new cases cover
  Portuguese, leadership and product-vs-person.

### J. Documentation

- **FR-53 (M)** README rewritten per D24; contributor/setup detail moved to `CONTRIBUTING.md`; the stale
  `ensureStatic` paragraph and the duplicated departure paragraph corrected; every claim in it is true of
  the code at the time it merges.

## 5. Non-functional requirements

- **NFR-1 Performance.** Lighthouse budgets in `lighthouserc.json` hold for `/` **and** `/pt` (perf ≥ 0.9,
  a11y 1, SEO 1, BP ≥ 0.95, LCP ≤ 3.5 s, TBT ≤ 300 ms, CLS ≤ 0.02). First-load client JS of `/` after
  FR-45 is at least 10% smaller than the baseline measured at the start of POR-59 (gzipped sum of
  same-origin scripts loaded by `/` on the production build), and no later task
  increases it by more than 5 KB gzipped (the switcher and catalogs included). Locale switching is a
  normal navigation to a prerendered page.
- **NFR-2 Accessibility.** Zero axe WCAG 2.1 A/AA violations in the existing key states, in both locales.
  The switcher: native links, visible label, `aria-current` on the active locale, `lang`/`hreflang` on
  each link, ≥ 44×44 px target, `focus-visible` ring. Each page's `lang` matches its content.
- **NFR-3 SEO.** Per FR-15; canonical points to the page's own locale; the e2e SEO spec covers both
  locales.
- **NFR-4 Fidelity.** English boards keep ≥ 99.9% per board outside their element masks; masks cover at
  most 3% of a board; boards with layout changes carry a recorded departure (D26). Every mask and
  departure states its task and reason in `scripts/fidelity/boards.ts`. Tasks that must be pixel-neutral
  (the catalog and brand-token extraction) add no mask and no departure.
- **NFR-5 Security.** CSP and headers unchanged; no new external origin at runtime (ingestion is
  offline); link allow-list per FR-34; no secret needed at build; ingestion respects `robots.txt` and the
  allow-list.
- **NFR-6 Resilience.** Every new out-of-process call has a timeout; every synchronous dependency of a
  request is behind a circuit breaker (FR-39).
- **NFR-7 Architecture.** `src/core` stays framework-free (dependency-cruiser passes with the FR-43 rules).
- **NFR-8 Translation integrity.** A test fails if any EN catalog key or knowledge-base text field lacks a
  PT counterpart, or if ids/dates/metric values/URLs differ between locales.
- **NFR-9 Truthfulness.** No task adds a fact not present in the résumé, the record, or an allow-listed
  site; Portuguese text is a translation, not a rewrite.
- **NFR-10 Delivery.** One task = one PR titled `POR-<nn>: <summary>`, Portuguese non-technical body with
  online test steps; merges on green CI (owner authorisation). Every bug fix ships a regression test.

## 6. Use cases

### UC-1 Read the portfolio in Portuguese

- Scope: portfolio site · Level: user-goal · Primary actor: Portuguese-speaking recruiter
- Stakeholders: recruiter (understand the candidate quickly in their language); owner (accurate
  representation); reuser (same mechanism works for their profile).
- Preconditions: the visitor is on any English page.
- Success end: the visitor reads the counterpart page fully in Portuguese and can come back to English
  with their earlier conversation intact.
- Trigger: the visitor activates "PT" in the switcher.

Main success scenario:

1. Visitor chooses Portuguese in the switcher.
2. System navigates to the `/pt` counterpart of the current page.
3. System shows the page entirely in Portuguese, with its own (empty or earlier) conversation.
4. Visitor reads the topic's record and asks a suggested question.
5. System answers instantly in Portuguese from the record, with Portuguese follow-ups.
6. Visitor chooses English; System returns to the English page with its earlier conversation intact.

Extensions:

- 2a. Visitor opens a `/pt` link directly (shared or from search): System serves the Portuguese page;
  no redirect.
- 3a. Visitor is on a phone: the switcher is in the drawer; the welcome screen already shows contact and
  résumé.
- 5a. Visitor writes the question in English on the Portuguese page: System answers in English.
- 5b. The question is ambiguous in language: System answers in Portuguese.
- 5c. The question is not recognised: System escalates to the model, which answers in the question's
  language; if the model is unavailable, System says so in the page's language and offers recognised
  questions.
- *a. Visitor follows an unknown `/pt/...` path: System shows the Portuguese 404.

### UC-2 Evaluate the candidate quickly (recruiter, any locale)

- Primary actor: recruiter on a phone · Goal: decide whether to contact.
- Main success scenario:
  1. Recruiter opens the home page.
  2. System shows heading, headline, evidence line (companies + two metrics), contact and résumé.
  3. Recruiter downloads the résumé in the page's language.
  4. System serves the generated PDF, current job first.
  5. Recruiter reaches out through a contact link.
- Extensions: 3a. Recruiter asks "is he available / where is he?": System answers with D16 availability
  and says the city is not documented.

### UC-3 Ask about a side project

- Primary actor: visitor · Goal: learn what a product is and what Marcio did on it.
- Main success scenario:
  1. Visitor asks what EvCopilot is.
  2. System answers with what the product does, from the product's site, citing the site URL.
  3. Visitor asks what Marcio built on it.
  4. System answers only with what the record says about his role, or states that his specific role is
     not documented — never attributing the site's claims to him.

### UC-4 Make the site someone else's (reuser)

- Primary actor: developer who forked the repository · Goal: run their own portfolio.
- Main success scenario:
  1. Reuser edits the profile folder (content in both languages, links, brand colours and fonts,
     share-image text, résumé data).
  2. Reuser rebuilds the retrieval index and runs the tests.
  3. System's tests pass, including the "no owner literal outside the profile" check against the new
     profile.
  4. Reuser deploys; every page, card, answer, metadata, share image and PDF shows their data.
- Extensions: 2a. A PT field is missing: the translation-integrity test names it. 3a. An old owner literal
  remains in code: the whitelabel test names the file and line.

### UC-5 Recover from an interrupted answer

- Primary actor: visitor · Goal: get an answer after retrying.
- Main success scenario:
  1. Visitor asks a question; System streams the answer.
  2. Visitor retries or edits an older answer while it streams.
  3. System cancels the in-flight answer and streams the new one; no answer remains in "streaming".
- Extensions: 1a. The model stalls: System keeps the stream alive with heartbeats and ends it with the
  interrupted event at the overall time limit; the visitor sees a retryable error naming what failed.

## 7. Acceptance criteria

Given/When/Then. Each AC is the definition of done for its FR and will seed the test plan.

### A. Whitelabel

- **AC-1.1** Given the repository, when the whitelabel test scans the tracked files under `src/`,
  `scripts/`, `e2e/` and `public/` outside the profile folder and the fixture profile, then it finds none of the profile's name, first name, email, LinkedIn/GitHub URLs or
  handles, domain, company names or metric values (the test reads the values from the profile, so it works
  for any profile).
- **AC-4.3** Given `src/core`, when the whitelabel scan runs, then no owner-specific intent name (e.g.
  `hrisRole`, `staffFit`) or owner vocabulary (e.g. `hris`, `ufpb`) appears; the HRIS-lead and Staff-scope
  answers come from profile copy, and removing them from a fixture profile removes the answers without a
  core change.
- **AC-54.1** Given the fixture profile (a fictional person, e.g. "Ada Rivera" at "Acme"), when the core,
  http, site and UI suites run, then they pass and assert the fixture's values; no fixture term overlaps an
  owner term.
- **AC-54.2** Given a fork that replaces only the profile folder with another valid profile and rebuilds the
  index, when `pnpm test` runs, then it passes without editing any test.
- **AC-55.1** Given the e2e suites, when inspected by the whitelabel scan, then they contain no owner
  literal, and the journeys pass against the real profile reading their expectations from it.
- **AC-1.2** Given a fixture profile with a different name, colours and contact, when the site is built in
  the test harness, then the home page title, welcome heading, contact card, JSON-LD and share-image text
  show the fixture's values.
- **AC-3.1** Given the profile's brand colours, when the page, share image and icon are rendered, then all
  three use the same values and no second hand-maintained colour list exists (the old equality test is
  replaced by a single source).
- **AC-4.1** Given the knowledge base with a role's dates changed in a test fixture, when the career
  fast-path answer is produced, then the answer shows the changed dates (no literal date survives).
- **AC-4.2** Given `src/core/assistant`, when the whitelabel test runs, then no company name, year or
  metric value appears as a literal there.
- **AC-5.1** Given the profile folder, when a reader opens it, then a guide lists every file a reuser edits
  and the commands to run after editing (`pnpm rag:build`, `pnpm test`).

### B. Internationalisation

- **AC-6.3** Given a production build, when `/en` and `/en/skills` are requested, then each answers 308 to
  `/` and `/skills`; no request the site makes while browsing has a path starting with `/en/`.
- **AC-56.1** Given the build produced by any task before Portuguese is enabled (POR-64, POR-65), when
  `/pt` and `/pt/skills` are requested, then they answer 404, the sitemap and `hreflang` list no
  Portuguese URL, and no switcher renders; given the build after POR-66, all of them are present.
- **AC-6.1** Given a production build, when `/`, `/experience`, `/skills`, `/projects`, `/achievements`,
  `/philosophy`, `/education` and their `/pt` counterparts are requested, then each answers 200 from a
  prerendered page.
- **AC-6.2** Given a production build, when `/nope` and `/pt/nope` are requested, then each answers 404 with
  the 404 page in English and Portuguese respectively.
- **AC-7.1** Given any `/pt` page, when it renders, then `<html lang="pt-BR">` and no EN catalog string is
  visible (checked by e2e over every page and key state: welcome, answer, error, rate-limited, drawer).
- **AC-7.2** Given any English page, when it renders, then `<html lang="en">` and English fidelity boards
  still pass (NFR-4).
- **AC-8.1** Given `/skills`, when the visitor activates "PT", then the URL becomes `/pt/skills`; given
  `/pt/skills`, "EN" leads to `/skills`.
- **AC-8.2** Given the switcher, when navigated by keyboard and read by a screen reader, then each option
  is a link with an accessible name in its own language, the active one has `aria-current="page"`, and the
  focus ring appears on `focus-visible` only.
- **AC-8.3** Given a 390×844 phone, when the drawer is opened, then the switcher is visible and operable in
  the drawer.
- **AC-9.1** Given a conversation on `/experience`, when the visitor switches to `/pt/experience`, asks a
  question, and switches back, then the English conversation is unchanged and the Portuguese one is kept
  for that page.
- **AC-9.2** Given an answer streaming on `/experience`, when the visitor switches to Portuguese and back,
  then the answer has continued (not restarted, not stuck).
- **AC-10.1** Given each suggested question in Portuguese, when asked on any page, then the fast path
  answers it in Portuguese.
- **AC-10.2** Given an English suggested question asked on a `/pt` page, then the answer is in English.
- **AC-10.3** Given an ambiguous question ("React?") on a `/pt` page, then the answer is in Portuguese; on
  an English page, in English.
- **AC-11.1** Given the model path, when a question in Portuguese is asked on an English page, then the
  model's reply is in Portuguese (eval case).
- **AC-12.1** Given the suggestion-graph test, when run per locale, then every question reachable from the
  topics and follow-ups is answered by the fast path in that locale.
- **AC-13.1** Given the two knowledge-base locales, when the integrity test runs, then every text field has
  a counterpart and ids, dates, metric values and URLs are identical.
- **AC-14.1** Given the committed index, when the corpus-hash test runs, then it matches the corpus of both
  locales; given a Portuguese query about Deel, retrieval returns Deel passages.
- **AC-15.1** Given `/pt/experience`, when a crawler reads it, then the title and description are
  Portuguese, the canonical is `/pt/experience`, and `hreflang` links list `en`, `pt-BR` and
  `x-default`→`/experience`.
- **AC-15.2** Given the sitemap, then it lists all 14 page URLs with their alternates.
- **AC-15.3** Given `/pt`, then the JSON-LD `Person` has the Portuguese job title/description and the share
  image at the Portuguese URL is 1200×630 with Portuguese text.
- **AC-16.1** Given a role ending March 2026, then it reads "Mar 2026" on English pages and "mar. 2026" on
  Portuguese pages.

### C. Record and presentation

- **AC-17.1** Given both locales, when the home page, title, meta description, OG/Twitter tags, welcome
  screen and overview intro are read, then they carry the D17 headline and none contains "Staff-level".
- **AC-17.2** Given "What makes Marcio a strong Staff Engineer?" (or its replacement suggestion), then the
  answer argues scope with facts from the record and never claims a Staff title.
- **AC-18.1** Given the contact card and "Where is he based / is he available?", then both show
  "Brazil · remote · UTC−3 · open to opportunities" (PT equivalent) and the answer says the city is not
  documented.
- **AC-19.1** Given the Toptal role, then no metric is attached and no highlight reads "Collaborates with
  the Director and CEO"; the replacement sentence is traceable to an existing Toptal highlight.
- **AC-20.1** Given the experience timeline in both locales, then no element reads "Concurrent" and Roots,
  Maison Modern and Freelance each show "Contract"/"Contrato".
- **AC-21.1** Given the projects page, then the portfolio appears with its stack, repo link, live link and
  two outcomes; FictionDraft shows "Concept"/"Conceito" and no live link.
- **AC-22.1** Given a 390×844 viewport on `/` and `/pt`, then contact and résumé actions are visible on the
  welcome screen without opening the drawer.
- **AC-23.1** Given the welcome screen at 390, 760 and 1440 px, then the evidence line is visible above the
  fold under the heading and its companies and metrics equal the knowledge base's (changing a metric in a
  fixture changes the line).
- **AC-23.2** Given the boards Main, Mobile and WelcomeScreen, then each carries a departure naming the task
  and reason; every other board passes ≥ 99.9% outside its element masks, and no board's masks exceed 3%
  of its area (the check fails a board whose masks do).
- **AC-24.1** Given `gh repo view --json homepageUrl,repositoryTopics`, then the homepage is
  `https://marciomariani.dev` and the D11 topics are present.

### D. Product-site knowledge

- **AC-25.1** Given the ingestion script with its allow-list, when run, then only allow-listed URLs are
  fetched (robots.txt respected, timeouts set), and each new passage in the index has `sourceUrl` and
  `fetchedAt`.
- **AC-25.2** Given a production build with no network, then the build succeeds and the index is
  unchanged (no build-time fetch).
- **AC-26.1** Given the eval case "What did Marcio build at EvCopilot?" (and its PT twin), then the answer
  states only record-backed facts about his role or says it is not documented, and contains none of the
  site's product claims phrased as his achievement (`avoids` list).
- **AC-26.2** Given "What is FormDaily?", then the answer describes the product from its site and lists the
  site URL among the sources.
- **AC-27.1** Given a project with no stated stack, then its card has no technologies row; given a project
  whose site states a stack, then the card lists exactly those technologies.

### E. Résumé PDF

- **AC-28.1** Given a production build, then `/marcio-alves-resume.pdf` (EN, unchanged URL) and, once PT
  is enabled, `/pt/marcio-alves-curriculo.pdf` return `application/pdf`, generated from the knowledge base, roles newest first with Toptal first.
- **AC-28.2** Given `/pt`, then the résumé link targets the PT PDF; given `/`, the EN PDF.
- **AC-29.1** Given the extracted text of both PDFs, then it contains the phone number, contains none of
  "teams.Strong", "Ci/Cd", "Ux/Ui", "Seo Optimization", "Da Paraíba", and every role, metric and date in it
  exists in the knowledge base.
- **AC-29.2** Given the site and the assistant, then the phone number appears nowhere except the PDFs, and
  "what's his phone number?" is declined as private.

### F. Assistant

- **AC-30.1** Given the model text "If you ask about performance, he cut load time by 50%.", when the
  offer filter runs, then the sentence is kept; given "Feel free to ask if you need more information.",
  then it is removed. (Regression test fails on today's code.)
- **AC-31.1** Given each of "Did he act as a tech lead at Deel?", "How does he think about codebase
  health?", "Has he built password reset flows?", "Does he know React children patterns?", when routed,
  then the result is an answer or an escalation, not a refusal. (Regression tests fail today.)
- **AC-32.1** Given a request with `context.lastIntent = "constructor"` (and `"__proto__"`), when
  handled, then the response is 400 or a normal answer without context, and no TypeError is thrown.
  (Regression test fails today.)
- **AC-33.1** Given an answer streaming, when the visitor retries an older answer, then the streaming
  answer ends (cancelled state) and only the new answer streams; same for edit. (Regression test fails
  today.)
- **AC-34.1** Given model text with a link to `https://evil.example`, then it renders as plain text; a link
  whose URL came from an action result renders as a link.
- **AC-35.1** Given the eval cases "Has he led teams?" and "Ele já liderou equipes?", then over 3 runs at
  least 2 answers mention the Deel HRIS team lead and Roots team growth, and every cited source's evidence
  appears in the tool trace.

### G. Robustness

- **AC-36.1** Given 10 000 distinct client keys each seen once, when the window passes and the next request
  arrives, then the maps hold only active keys (size check with a controlled clock).
- **AC-37.1** Given requests from `2001:db8:1:2::a` and `2001:db8:1:2::b`, then they share one limit and one
  budget key; `2001:db8:1:3::a` does not.
- **AC-38.1** Given a model answer aborted after consuming tokens (for which the provider reports no
  usage), then the daily budget is reduced by at least the tokens consumed, estimated conservatively from
  the characters sent and received.
- **AC-39.1** Given an embeddings call that hangs, then it fails at its timeout; given an aborted request,
  then the embeddings call is aborted; given repeated failures, then the breaker opens and the
  assistant degrades to the fast path / no-retrieval answer.
- **AC-39.2** Given a tool whose `execute` throws, then the model receives a tool error and the request
  completes.
- **AC-40.1** Given a GitHub or Wikipedia response with an unexpected shape or a 5xx, then the adapter
  logs status and cause and returns its degraded result; no unvalidated cast remains.
- **AC-41.1** Given a model that produces nothing for 40 s, then the client receives heartbeats and does
  not hit its 30 s idle timeout; given a request exceeding the overall limit, then the stream ends with the
  interrupted event.
- **AC-41.2** Given the chat route, then its `maxDuration` is above the overall limit (75 s vs 60 s), verified
  on a preview deployment: a request held past 60 s ends with the interrupted event, not a platform
  timeout.

### H. Architecture

- **AC-42.1** Given `src/app`, then it contains only route segments and Next.js special files; the six topic
  route files are thin and identical in shape, delegating to one shared implementation.
- **AC-43.1** Given a deliberate import from `src/ui` to `src/infrastructure` (and each other forbidden
  edge) in a fixture, then `pnpm boundaries` fails; given a client component importing a server-only
  module, then `pnpm build` fails.
- **AC-44.1** Given `pnpm boundaries`, then no cycle is reported between `core/knowledge` and
  `core/assistant`.
- **AC-45.1** Given the production client bundles, then none contains a knowledge-base-only string (e.g. a
  résumé highlight sentence); topic records still render (e2e).
- **AC-46.1** Given the codebase, then each listed contract has one definition imported by both sides, and
  a change to the question length limit changes both the composer limit and the server schema.
- **AC-47.1** Given the full test suite before and after, then behaviour is unchanged; the listed
  functions/maps are typed by their unions (a misspelt key fails typecheck).

### I. Tests and CI

- **AC-48.1** Given the four parser edge cases, then each has a test and the parser yields the expected
  events.
- **AC-49.1** Given the motion e2e suite run 20 times locally, then it passes 20/20 with no fixed sleep or
  single-shot timing assertion.
- **AC-50.1** Given a PR that lowers `src/core` or `src/infrastructure` coverage below the thresholds, then
  CI fails; the README states the thresholds and why.
- **AC-51.1** Given a PR touching `src/ui`, then the fidelity job runs in the pinned container and passes
  at ≥ 99.9% per board (masks and departures per D26), or (if recorded as report-only, with the reason in
  the README) publishes the per-board report as an artifact.
- **AC-51.2** Given the repository, then the design export is committed under `design/` and served with its
  own runtime to capture the CI references, and the CI references are regenerated only by a dedicated
  workflow that opens a PR.
- **AC-52.1** Given `pnpm eval:assistant`, then each case runs 3 times, the report shows per-case pass
  rates, injection cases have `avoids`, calibration failures show the tool trace, and PT, leadership and
  product-vs-person cases exist.

### J. Documentation

- **AC-53.1** Given the README, then its first screen shows the live link and a screenshot, followed by
  what/why, stack, how it's built, how it was delivered (AI-assisted process stated), and a link to
  `CONTRIBUTING.md`; setup instructions are in `CONTRIBUTING.md`.
- **AC-53.2** Given the README, then it no longer mentions `ensureStatic`, and every command and number it
  states matches `package.json` and the config files.

## 8. Deliverable breakdown

The tasks use the reserved block **POR-41…POR-70** (POR-71 is spare). POR-35 has merged, so no task
waits for it. Ordering comes **only** from dependencies, which include **file conflicts**: two tasks
that edit the same file are ordered, even when neither needs the other's behaviour. **IDX** means the
task rebuilds the committed retrieval index (`pnpm rag:build`, owner's local key); IDX tasks run
strictly in series (D29). **Set** is the earliest parallel set a task can join: tasks in the same set
can be implemented in parallel and are merged in series. One task = one PR.

### Task table

| Id     | Task                                                                                                                                                                                                                | FR / AC                                                  | Depends on     | Set | Main files / conflict reason                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------- | --- | ----------------------------------------------------------------------------------------------------------------- |
| POR-41 | Offer filter keeps factual sentences                                                                                                                                                                                | FR-30                                                    | —              | S1  | `core/assistant/system2/offer-filter*`                                                                            |
| POR-42 | Router stops refusing valid questions                                                                                                                                                                               | FR-31                                                    | —              | S1  | `system1/router*`                                                                                                 |
| POR-43 | Forged context intents never throw                                                                                                                                                                                  | FR-32                                                    | 42             | S2  | `system1/router.ts` (shared with 42), `fast-path.ts`, chat-handler schema                                         |
| POR-44 | Boundary rules, server-only guards, knowledge↔assistant cycle                                                                                                                                                       | FR-43, FR-44                                             | 43             | S3  | `.dependency-cruiser.cjs`, citations, chat-handler (shared with 43)                                               |
| POR-45 | Bounded limiter/budget memory, IPv6 /64, interrupted tokens (conservative estimate)                                                                                                                                 | FR-36–38                                                 | 44, 49         | S4  | `infrastructure/rate-limit`, `budget`, `client-key`, `model-assistant.ts` (shared with 49)                        |
| POR-46 | Embeddings timeout/abort/breaker, tool exceptions, adapter validation + logging                                                                                                                                     | FR-39, FR-40                                             | 44, 45         | S5  | `infrastructure/openai`, `github`, `wikipedia`, `tools/*`, `model-assistant.ts`, composition root                 |
| POR-47 | Evaluation harness: N runs + pass rate, tool-trace calibration, injection `avoids`, leadership + product-vs-person cases                                                                                            | FR-52 (part)                                             | —              | S1  | `scripts/evaluation`, `scripts/evaluate-assistant.mts`                                                            |
| POR-48 | Coverage thresholds on core and infrastructure                                                                                                                                                                      | FR-50                                                    | —              | S1  | `vitest.config.mts`, `ci.yml`, README section                                                                     |
| POR-49 | Core code health: `answer()` split, temperature comment, typed intent/topic tables, single company patterns                                                                                                         | FR-47 (core)                                             | 41, 42, 43     | S3  | `model-assistant.ts`, `system1/*`                                                                                 |
| POR-50 | Link allow-list for model answers                                                                                                                                                                                   | FR-34                                                    | 46             | S6  | `system2/link-filter`, `model-assistant.ts`                                                                       |
| POR-51 | Model answer quality: leadership retrieval, sources limited to used evidence                                                                                                                                        | FR-35                                                    | 46, 47, 50     | S7  | `system-prompt.ts`, `search-tools.ts`, `model-assistant.ts`                                                       |
| POR-52 | Profile folder + knowledge injection into core (EN-only authoring, core factories take `Knowledge`, eval cases and index move to the profile, whitelabel test scoped)                                               | FR-1 (part), FR-2 (part), FR-5, AC-1.1 (scoped)          | 44, 46, 47, 49 | S6  | `src/profile/**`, `core/knowledge/*`, tools, composition root; corpus byte-identical (no IDX)                     |
| POR-53 | Move helpers out of `src/app` into `src/http` and `src/site`; fonts and brand colours to the profile; thin route files; `site`/`http` boundary rules                                                                | FR-42, FR-3 (data side)                                  | 52, 45         | S7  | `src/app/**`, `src/http/*`, `src/site/*`, `site-root.ts`; chat-handler (shared with 45)                           |
| POR-54 | Fast-path facts from the record; answer prose, owner intents and vocabulary to the profile; core tests on the fixture profile                                                                                       | FR-4, FR-54 (core), AC-4.1–4.3, AC-54.1 (core)           | 52, 51         | S8  | `core/assistant/*`, `system1/responses/*` → profile copy, `src/testing/fixture-profile`                           |
| POR-55 | Record corrections: headline, availability, Toptal line, Contract tag, portfolio project, FictionDraft concept, title/meta/OG text, typos                                                                           | FR-17–21                                                 | 54, 53, 58     | S9  | **IDX**; `profile/knowledge`, `ui/rich/*`, `core/chat/components.ts` (from 58); masks/departures per design §11.2 |
| POR-56 | Product-site ingestion into the index; product-vs-person rule; stack only when stated                                                                                                                               | FR-25–27, AC-26.x                                        | 55, 51         | S10 | **IDX**; `scripts/ingest*`, `profile/sites`, corpus, system prompt                                                |
| POR-57 | Retry/edit cancels the in-flight answer                                                                                                                                                                             | FR-33                                                    | —              | S1  | `ui/chat/use-chat.ts`, `conversation-store.tsx`                                                                   |
| POR-58 | Single client/server contracts; question limit with the request policy                                                                                                                                              | FR-46                                                    | 57, 43, 53     | S8  | `core/chat/*`, `ui/chat/chat-client.ts`, `http/chat-handler.ts`                                                   |
| POR-59 | Knowledge base out of the client bundle (+ client-JS baseline)                                                                                                                                                      | FR-45, NFR-1                                             | 58, 54         | S9  | `site/workspace-view`, `core/conversation`, `ui/chat/*`                                                           |
| POR-60 | SSE heartbeat, overall time limit, `maxDuration` 75 s, parser edge cases                                                                                                                                            | FR-41, FR-48, AC-41.2                                    | 58             | S9  | `http/event-stream.ts`, `ui/chat/sse-parser.ts`, `chat-client.ts`, chat route                                     |
| POR-61 | UI code health: ChatWorkspace mapping, shared copy-confirm timer, stable store context                                                                                                                              | FR-47 (UI)                                               | 59             | S10 | `ui/chat/*`                                                                                                       |
| POR-62 | Motion e2e waits on conditions                                                                                                                                                                                      | FR-49                                                    | —              | S1  | `e2e/motion.spec.ts`                                                                                              |
| POR-63 | EN interface catalog; brand tokens and fonts generated from the profile; http/site/UI tests on the fixture; e2e reads from the profile; whitelabel test at full scope                                               | FR-1, FR-2, FR-3, FR-54, FR-55, AC-1.x, AC-54.x, AC-55.1 | 61, 60, 55     | S11 | every `ui/*`, `globals.css` → `ui/globals.css`, `e2e/*`; pixel-neutral (no new mask or departure)                 |
| POR-64 | Locale routing (`/pt`, `/en`→308), switcher, per-locale conversations, `lang`, localized 404, per-locale metadata/hreflang/sitemap/JSON-LD/share image, locale formatting — **English only enabled**                | FR-6–9, FR-15, FR-16, FR-57, AC-6.3, AC-56.1             | 63             | S12 | `app/[locale]/**`, `next.config.ts`, `site/*`, `ui/shell/*`; opens with the routing spike                         |
| POR-65 | Portuguese content: catalog, knowledge base, topic copy, answer prose, product passages; translation-integrity test — **still not enabled**                                                                         | FR-13, FR-14, NFR-8, AC-56.1                             | 64, 56         | S13 | **IDX**; `profile/**`                                                                                             |
| POR-66 | Bilingual fast path, model locale tie-break, PT eval cases, per-locale suggestion graph, PT e2e/axe/Lighthouse, switcher masks — **enables Portuguese**                                                             | FR-10–12, FR-52 (PT), FR-56                              | 65, 51         | S14 | `core/assistant/language.ts`, `system1/rules.pt-BR.ts`, `profile/locales.ts`, `e2e/i18n.spec.ts`                  |
| POR-67 | Generated résumé PDF (EN keeps its URL, PT under `/pt`), replaces the hand-made PDF                                                                                                                                 | FR-28, FR-29                                             | 65, 55         | S14 | `scripts/resume/*`, `public/` (gitignored output), `package.json` build                                           |
| POR-68 | Phone welcome contact + résumé; evidence line; departures for Main, Mobile, WelcomeScreen                                                                                                                           | FR-22, FR-23                                             | 63, 55, 67     | S15 | `ui/welcome/*`, `site/workspace-view`, profile copy (both locales)                                                |
| POR-69 | Fidelity in CI: pinned container, **orchestrator commits the design export under `design/`** (served with its runtime), CI references from it, masks support; report-only with recorded reason if 99.9% cannot hold | FR-51, AC-51.1, AC-51.2                                  | 66, 68         | S16 | `.github/workflows/*`, `scripts/fidelity/*`, `design/**`, `fidelity/reference-ci/`                                |
| POR-70 | README rewrite, CONTRIBUTING split, screenshot, `gh repo edit` homepage + topics                                                                                                                                    | FR-53, FR-24                                             | all of 41–69   | S17 | `README.md`, `CONTRIBUTING.md`                                                                                    |

Notes on the edges that exist only because of file conflicts: 43←42 (router), 44←43 (chat handler),
45←49 and 46←45 and 50←46 and 51←50 (`model-assistant.ts`), 52←46/47 (composition root, eval cases),
53←45 (chat handler move), 55←58 (`core/chat/components.ts`), 63←60 (`chat-client.ts` error copy).

### Parallel sets

| Set | Tasks (implement in parallel, merge in series) |
| --- | ---------------------------------------------- |
| S1  | 41, 42, 47, 48, 57, 62                         |
| S2  | 43                                             |
| S3  | 44, 49                                         |
| S4  | 45                                             |
| S5  | 46                                             |
| S6  | 50, 52                                         |
| S7  | 51, 53                                         |
| S8  | 54, 58                                         |
| S9  | 55, 59, 60                                     |
| S10 | 56, 61                                         |
| S11 | 63                                             |
| S12 | 64                                             |
| S13 | 65                                             |
| S14 | 66, 67                                         |
| S15 | 68                                             |
| S16 | 69                                             |
| S17 | 70                                             |

The IDX tasks (55 → 56 → 65) fall in different sets by construction. Portuguese becomes visible only
when POR-66 merges (D30, AC-56.1).

### Dependency map

```
Edges (task ← its dependencies):
43←42 · 44←43 · 45←44,49 · 46←44,45 · 49←41,42,43 · 50←46 · 51←46,47,50 · 52←44,46,47,49 · 53←52,45
54←52,51 · 55←54,53,58 · 56←55,51 · 58←57,43,53 · 59←58,54 · 60←58 · 61←59 · 63←61,60,55 · 64←63
65←64,56 · 66←65,51 · 67←65,55 · 68←63,55,67 · 69←66,68 · 70←all
```

### Risks

| Risk                                                                           | I×P    | Response                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Index rebuilds need the owner's OpenAI key locally; parallel rebuilds conflict | 4×3=12 | Mitigate: IDX tasks strictly serial; the implementer runs `pnpm rag:build` with `.env.local`; a task blocked by a missing key is routed around and reported. |
| Content corrections and the switcher change most English boards                | 4×4=16 | Mitigate: element masks capped at 3% per board (D26) keep those boards gated; departures only for layout changes.                                            |
| Locale rewrites leak `/en/` URLs or break prefetch                             | 5×2=10 | Mitigate: spike at the start of POR-64; AC-6.3 e2e assertion.                                                                                                |
| Migrating tests to the fixture profile weakens assertions                      | 4×2=8  | Mitigate: fixture exercises every intent; reviewers apply `meaningful-tests`.                                                                                |
| Product-site text leaks into claims about Marcio                               | 5×3=15 | Mitigate: passages typed as product facts, system-prompt rule, eval `avoids` cases (AC-26.1).                                                                |
| Machine-drafted Portuguese reads unnaturally                                   | 3×3=9  | Accept: owner reviews live after merge (D6); fixes are copy-only PRs.                                                                                        |
| Fidelity cannot hold 99.9% in the CI container                                 | 3×3=9  | Accept: report-only with recorded reason (D14); references come from the committed design export.                                                            |
| Bilingual catalogs inflate client JS                                           | 3×2=6  | Mitigate: NFR-1 budget; only the page locale's catalog is shipped.                                                                                           |
