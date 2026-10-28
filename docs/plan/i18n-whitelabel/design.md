# Design — Bilingual, whitelabel portfolio and review remediation (`i18n-whitelabel`)

Status: draft for approval · Input: `prd.md` (FR-1…FR-53, POR-41…POR-70) · Author: solution architect ·
Date: 2026-10-28

This document decides **how** the PRD is built. Every section names the requirements it serves; §16 is the
full traceability table. Where the PRD is wrong or underspecified, §15 says so and gives the fix.

---

## 0. Ground truth the plan must start from

Surveyed on `main` at `c913837`; the planning branch is rebased onto it. Task ids follow the revised PRD (POR-41…POR-70).

| Fact                                                                                                                                                                                                                               | Consequence                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POR-35 is merged** (`3fa77b7`): `use-reveal.ts`, `thinking-status.tsx`, `reveal.ts`, site-wide "one question at a time" (`store.busy`, `chat.waiting`), `disabled` suggestion chips, `--animate-shimmer` + `@keyframes shimmer`. | No task waits for it. Its code changes this design in five places, collected in §0.1.                                                                 |
| **POR-36 ("cite the résumé once") is merged** (`51c546c`): every `resume.*` source label is `Resume`, and `AssistantMessage` carries a departure in `boards.ts`.                                                                   | The labels become `Localized` in `profile/knowledge/sources.ts` (`Resume` / `Currículo`); the existing departure stays.                               |
| `src/ui/chat/assistant-message.tsx` and `chat-workspace.tsx` import `knowledgeBase` / `roleById`; `core/conversation/conversation.ts` imports `topics` and `topic-pages`.                                                          | The whole knowledge base ships in the client bundle today (root cause of FR-45).                                                                      |
| `core/knowledge/knowledge-base.ts` imports `AnswerSource` from `core/assistant/assistant-event`.                                                                                                                                   | The `knowledge ↔ assistant` package cycle (FR-44).                                                                                                    |
| `src/app/api/chat/chat-handler.ts` imports `Admission` from `infrastructure`.                                                                                                                                                      | The only existing edge the new `app ↛ infrastructure` rule (FR-43) breaks.                                                                            |
| Owner literals appear in **83 files** outside `core/knowledge/data`, most of them tests and e2e specs.                                                                                                                             | FR-2 / UC-4 cannot hold unless tests run against a fictional fixture profile (§4.6; FR-54, FR-55).                                                    |
| Design artboards (`*.dc.html`) are **not** in the repository; references are PNGs captured on the owner's machine.                                                                                                                 | POR-69 cannot capture CI references unless the design export is committed (§11.3; the orchestrator commits it in POR-69).                             |
| `next/root-params` exists (Next 16.3+), and `createSegmentKey` keys a dynamic segment by `name                                                                                                                                     | type`, **not by its value** (`next/dist/client/components/router-reducer/create-segment-key.js`); `isNavigatingToNewRootLayout` ignores param values. | A root layout at `app/[locale]` keeps its React state when the locale changes. FR-9 and AC-9.2 rely on this. |

### 0.1 What POR-35's merged code changes in this design

1. **Locale switch reuses the page component.** The `[locale]` state key ignores the value, and so does the `experience` page segment below it. Without a key, `/experience` → `/pt/experience` would reuse the same `ChatWorkspace` instance, carrying over the draft, the drawer state and `useReveal`'s `opened` set. **Fix (POR-64):** the site renders `<ChatWorkspace key={`${locale}:${topic}`} …>`. The conversations stay in the provider, keyed the same way, so AC-9.1 and AC-9.2 hold. An answer still streaming when the visitor comes back appears whole, which is POR-35's rule for answers that were already there.
2. **"One question at a time" is site-wide.** `store.busy` scans every conversation, so it spans both locales once the keys include the locale. That is the intended behaviour: a PT page waits while an EN answer streams. `chat.waiting` and its helper text ("Another answer is on its way…") go to `UiMessages` (POR-63).
3. **`thinking-status.tsx` holds a phrase list** that names the owner ("Reading Marcio's documented experience"). It becomes `UiMessages.thinking: readonly Template[]` with `{firstName}` filled from the workspace view (POR-63). The whitelabel scan would flag it otherwise.
4. **Cancelling must also finish the reveal.** `cancel()` in POR-57 marks the in-flight answer `stopped`, and `ChatWorkspace` calls `reveal.finish()`. `useReveal` already shows a `stopped` answer whole, so no reveal change is needed beyond the existing `finish`.
5. **`globals.css` gained `--animate-shimmer` and `@keyframes shimmer`.** They are motion tokens, not brand tokens: they move with the file to `src/ui/globals.css` (POR-63) and are not generated. `e2e/motion.spec.ts` now exercises the thinking and typing states, which POR-62 rewrites to condition-based waits.

---

## 1. Decisions at a glance

| #   | Decision                   | Chosen                                                                                                                                                                                                                                                                                 | Why (rejected alternatives in the section)                                                                                                                                                                                                                                                                                                                                                                                   | Serves                   |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| A1  | Locale routing             | Root layout at `app/[locale]` (segments `en`, `pt`), with **`next.config` `afterFiles` rewrites** mapping unprefixed paths to `/en/…`. A redirect sends `/en/…` to the unprefixed URL. Locale read with `next/root-params`.                                                            | One root layout keeps the conversation provider mounted across a locale switch (AC-9.2). The rewrites run in Vercel's routing layer, so no function runs per request, unlike `proxy.ts`. Root params keep every page prerendered under `cacheComponents`. §3                                                                                                                                                                 | FR-6, FR-7, FR-9, D2, D3 |
| A2  | i18n library               | **In-house typed catalogs**: TS objects per locale, typed by interfaces their consumers own, plus a ~40-line framework-free formatter (`Intl.PluralRules`, `Intl.DateTimeFormat`). No `next-intl`.                                                                                     | `core` must localize fast-path answers and cannot import a framework package. One mechanism serves core, server and client. Two locales and plural-only needs don't justify ICU. NFR-1 caps later tasks at +5 KB gzipped. `next-intl` adds runtime, and under `cacheComponents` it has `setRequestLocale`/`Link` caveats. Its routing would duplicate root params, and its detection and cookie are both disabled by NG3. §5 | FR-7, FR-10, NFR-1       |
| A3  | Where owner data lives     | `src/profile/`: one folder, data and copy only, plus one `fonts.ts` that calls `next/font`. **Core never imports it.** Core receives the knowledge base and answer copy **by injection**. The roots (`composition-root.ts`, `site-root.ts`) bind it.                                   | Dependency Rule. Profile → core is the only legal direction. Injection is also what AC-1.2, AC-4.1 and AC-23.1 need, since each changes a fixture and expects the output to follow. §2, §4                                                                                                                                                                                                                                   | FR-1…FR-5, G2            |
| A4  | Knowledge localization     | **One shared structure, localized leaves**: `{ en: '…', 'pt-BR': '…' }` on every text field. Ids, dates, metric values, URLs and flags appear once. `localize(source, locale)` produces the monolingual `Knowledge` that core code reads.                                              | Ids, dates and metrics are identical across locales by construction (AC-13.1). A missing translation is a validation error that names its path (UC-4 2a). §6                                                                                                                                                                                                                                                                 | FR-13, NFR-8             |
| A5  | Brand tokens → Tailwind v4 | `src/profile/brand.ts` (source) → `pnpm brand:css` → committed `src/profile/generated/brand.css` with an `@theme { --color-*; }` block, imported by the global stylesheet. A drift test regenerates it and compares. Share image, icon and PDF read `brand.ts` directly.               | Static CSS: no runtime inline style, CSP unchanged, no Tailwind compat layer. It is still a single source, because the generated file is not hand-kept. The old two-copy equality test is replaced. §4.4                                                                                                                                                                                                                     | FR-3, AC-3.1             |
| A6  | Messages on the client     | A client `I18nProvider` in the `[locale]` layout carries **only that locale's `ui` catalog** (plain strings and plural objects, all serializable). Server components get copy as props from `site/`.                                                                                   | It ships one locale only (NFR-1). Without it, props would drill through more than two levels (AppShell → Sidebar → Footer). §5.3                                                                                                                                                                                                                                                                                             | FR-7, NFR-1              |
| A7  | Shared wire contracts      | New `src/core/chat/`: `events.ts` (event union, `ASSISTANT_EVENT_TYPES`, `INTERRUPTED`), `components.ts` (rich-block allow-list), `request.ts` (limits, `HistoryTurn`, `ConversationContext`), `request-schema.ts` (zod).                                                              | One definition each. The client imports the limits without pulling in zod. §7.4                                                                                                                                                                                                                                                                                                                                              | FR-46                    |
| A8  | Résumé PDF                 | **`@react-pdf/renderer` v4** in a build script (`scripts/generate-resume.mts`, plain Node via `tsx`). It writes gitignored `public/<file>` per enabled locale. `build` and `dev` run it first.                                                                                         | The only option that gives a real layout engine (flex, wrapping) without a browser at build time. It runs outside Next's bundler, so there is no RSC or `serverExternalPackages` friction (although Next already lists it as an external). Fonts are WOFF from `@fontsource`. §10                                                                                                                                            | FR-28, FR-29             |
| A9  | Site ingestion             | `scripts/ingest-sites.mts`: allow-list, plus `robots-parser`, `jsdom`, `@mozilla/readability`. It produces a committed `src/profile/sites/snapshot.json`. `rag:build` embeds it with the knowledge base. Nothing runs at build or request time.                                        | Offline, reviewable diff, reproducible. §9                                                                                                                                                                                                                                                                                                                                                                                   | FR-25…FR-27              |
| A10 | Fidelity in CI             | Pinned `mcr.microsoft.com/playwright:v1.64.1-noble@sha256:…` container, against **references captured in that container from the committed design export**. Element-scoped **masks** (with a reason and an area cap) for content-only differences; departures only for layout changes. | It is deterministic, because the rasterizer is identical on both sides. Masks keep a board gated instead of excusing all of it. §11                                                                                                                                                                                                                                                                                          | FR-51, D14, D26          |
| A11 | Controllers out of `app/`  | New `src/http/` (chat handler, event stream, client key, health handler) and `src/site/` (metadata, structured data, routes, workspace view, images, workbench fixtures). `src/app/` holds route files only.                                                                           | FR-42. `http` and `site` are Interface Adapters, each injected by a root. §2                                                                                                                                                                                                                                                                                                                                                 | FR-42, FR-43             |
| A12 | Server-only enforcement    | The `server-only` package in `composition-root.ts`, `site-root.ts` and `env.ts`. A **client-reachability test** walks the dependency-cruiser graph from every `'use client'` module. A **bundle scan** runs after the production build.                                                | Three independent layers: build, unit and artifact. §7.3                                                                                                                                                                                                                                                                                                                                                                     | FR-43, FR-45             |

---

## 2. Architecture and target structure

### 2.1 Layers and dependency direction

```
                ┌───────────────────────── Main (roots) ─────────────────────────┐
                │  src/app/** (route files)   src/site-root.ts   src/composition-root.ts │
                └──────┬──────────────┬───────────────┬──────────────┬───────────┘
                       │              │               │              │
                  src/http        src/site        src/profile   src/infrastructure
              (controllers)  (page presenters)   (owner data)     (adapters)
                       │              │     ╲  type-only ↗  │           │
                       │              ▼      ╲   src/ui      │           │
                       │          src/ui ◄────╲─(i18n types) │           │
                       ▼              ▼        ╲             ▼           ▼
                ┌──────────────────────── src/core (framework-free) ─────────────┐
                │ chat (wire contract) ◄─ assistant ◄─ conversation              │
                │        ▲                    │                                  │
                │        └─────────── knowledge (types, localize, corpus) ◄──────┘
                │ i18n (Locale, formatting) ◄─ everyone                          │
                └────────────────────────────────────────────────────────────────┘
```

Rules, enforced in §7.1:

- `core` imports nothing outside `core` (zod excepted, as today). Inside it: `i18n ← knowledge ← chat ← assistant ← conversation`. `knowledge` never imports `chat`, `assistant` or `conversation` (FR-44).
- `profile` imports `core` (types and the `localize`/`defineKnowledge` helpers), plus **type-only** imports from `ui/i18n` and `site`. Nothing imports `profile` except the two roots, the build scripts, its own tests, and `app/global-error.tsx` (which may only import `profile/global-error-copy.ts`).
- `site` (server presenters) imports `core` and `ui`. Its functions take the profile as a parameter, which is how AC-1.2 renders a fixture profile.
- `http` imports `core` and nothing concrete. Its dependencies arrive through `createChatHandler(container)`.
- `ui` imports `core/chat`, `core/conversation`, `core/i18n` and its own modules. It never imports `core/knowledge`, the `core/assistant` engine, `profile`, `site`, `http`, `infrastructure` or the roots.
- `infrastructure` imports `core` (ports and types) only.

### 2.2 Target tree

```
src/
├── app/                                   # route segments and Next special files ONLY
│   ├── global-error.tsx                   # own <html>; locale from usePathname; copy from profile/global-error-copy
│   ├── sitemap.ts                         # → site-root.sitemap
│   ├── robots.ts                          # → site-root.robots
│   ├── brand/icon.png/route.tsx           # tab icon (explicit route; see §3.5)
│   ├── api/
│   │   ├── chat/route.ts                  # POST + maxDuration → http/chat-handler
│   │   └── health/route.ts                # GET → http/health-handler
│   └── [locale]/
│       ├── layout.tsx                     # root layout: <html lang>, fonts, I18nProvider, ConversationsProvider
│       ├── page.tsx                       # overview (home)
│       ├── not-found.tsx                  # localized 404
│       ├── error.tsx                      # 'use client' → ui/status/page-failed
│       ├── [...rest]/page.tsx             # notFound() → localized 404 for unmatched paths
│       ├── brand/share-image.png/route.tsx# per-locale 1200×630 share image
│       ├── experience/page.tsx            # ┐
│       ├── skills/page.tsx                # │ six identical 4-line files:
│       ├── projects/page.tsx              # │ const page = site.topicPage('<id>')
│       ├── achievements/page.tsx          # │ export const generateMetadata = page.generateMetadata
│       ├── philosophy/page.tsx            # │ export default page.Page
│       ├── education/page.tsx             # ┘
│       └── workbench/…                    # dev-only route files (en only); helpers live in site/workbench
├── composition-root.ts                    # server-only; binds profile + adapters → Container (API)
├── site-root.ts                           # server-only; binds profile + fonts → site (pages)
├── env.ts                                 # server-only
├── instrumentation.ts                     # Next special file (stays at src/)
├── core/
│   ├── i18n/       locale.ts  format.ts  plural.ts                       (+ tests)
│   ├── chat/       events.ts  components.ts  request.ts  request-schema.ts
│   ├── knowledge/  schema.ts (types of the source + runtime Knowledge)  localize.ts
│   │               corpus.ts  validate.ts  dates.ts
│   ├── assistant/  assistant.ts  citations.ts  answer-kit.ts  topics.ts  topic-pages.ts
│   │               language.ts (question-language detection)
│   │               system1/ (router engine, rules.en.ts, rules.pt-BR.ts, guards, fast-path factory)
│   │               system2/ (model-assistant steps, system-prompt, offer-filter, link-filter, usage)
│   │               tools/  ports/
│   └── conversation/  conversation.ts  messages.ts  plain-text.ts
├── http/
│   ├── chat-handler.ts  event-stream.ts  client-key.ts  health-handler.ts      (+ tests)
├── site/
│   ├── routes.ts            # Locale ↔ segment, page paths, counterpart paths, asset paths
│   ├── metadata.ts          # root/topic metadata, alternates, hreflang, OG/Twitter
│   ├── structured-data.ts   # Person JSON-LD per locale + safe serialization
│   ├── sitemap.ts robots.ts
│   ├── workspace-view.ts    # serializable props for ChatWorkspace (seed conversation, nav, evidence line…)
│   ├── share-image.tsx icon.tsx image-fonts.ts   # next/og element builders
│   ├── create-site.tsx      # createSite(profile, fonts) → { RootLayout, topicPage, NotFound, … }
│   ├── site-copy.ts         # SiteCopy / SiteProfile types the profile satisfies
│   └── workbench/           # specimens + scenario builders (moved from app/workbench)
├── ui/
│   ├── globals.css          # moved from app/; imports ../profile/generated/brand.css
│   ├── i18n/                # ui-messages.ts (UiMessages type), i18n-provider.tsx ('use client'), use-messages.ts
│   ├── chat/ composer/ welcome/ shell/ rich/ status/ format/ primitives/  (as today)
│   └── shell/locale-switch.tsx   # server-renderable links; no 'use client'
├── infrastructure/          # as today; retrieval index no longer lives here (§6.4)
├── profile/                 # §4
└── testing/
    └── fixture-profile/     # fictional person ("Ada Rivera", "Acme", "Globex"), both locales
```

Top level, outside `src/`: `scripts/` (`ingest-sites.mts`, `generate-resume.mts`, `generate-brand-css.mts`, `build-knowledge-index.mts`, `evaluate-assistant.mts`, `fidelity/…`), `design/prototype/` (committed design export, §11.3), and `fidelity/reference/` plus `fidelity/reference-ci/`.

### 2.3 Move map (old → new)

| Old                                                                                                                          | New                                                                                                           | Task              |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/app/layout.tsx`                                                                                                         | `src/app/[locale]/layout.tsx` (thin) + `site/create-site.tsx#RootLayout`                                      | 53 → 64           |
| `src/app/page.tsx`                                                                                                           | `src/app/[locale]/page.tsx` (thin) + `site/create-site.tsx#homePage`                                          | 53 → 64           |
| `src/app/{experience,skills,projects,achievements,philosophy,education}/page.tsx`                                            | `src/app/[locale]/<id>/page.tsx` (identical shape)                                                            | 53 → 64           |
| `src/app/topic-page.tsx`                                                                                                     | `site/create-site.tsx#topicPage`                                                                              | 53                |
| `src/app/topic-routes.ts`                                                                                                    | `site/routes.ts`                                                                                              | 53                |
| `src/app/workspace-props.ts`                                                                                                 | `site/workspace-view.ts`                                                                                      | 53                |
| `src/app/structured-data.ts` (+test)                                                                                         | `site/structured-data.ts`                                                                                     | 53                |
| `src/app/brand-colors.ts` (+test)                                                                                            | deleted; values in `profile/brand.ts`, drift test in `profile/generated`                                      | 53, 63            |
| `src/app/fonts.ts`                                                                                                           | `src/profile/fonts.ts` (generic CSS variables `--font-face-text`, `--font-face-display`, `--font-face-code`)  | 53, 63            |
| `src/app/image-fonts.ts`                                                                                                     | `site/image-fonts.ts` (files named by `profile/brand.ts`)                                                     | 53                |
| `src/app/icon.tsx`                                                                                                           | `app/brand/icon.png/route.tsx` + `site/icon.tsx`                                                              | 64                |
| `src/app/opengraph-image.tsx`                                                                                                | `app/[locale]/brand/share-image.png/route.tsx` + `site/share-image.tsx`                                       | 64                |
| `src/app/not-found.tsx`                                                                                                      | `app/[locale]/not-found.tsx` + `app/[locale]/[...rest]/page.tsx`                                              | 64                |
| `src/app/error.tsx`, `global-error.tsx`                                                                                      | `app/[locale]/error.tsx`, `app/global-error.tsx`                                                              | 64                |
| `src/app/sitemap.ts`, `robots.ts`                                                                                            | stay; bodies in `site/sitemap.ts`, `site/robots.ts`                                                           | 53                |
| `src/app/globals.css`                                                                                                        | `src/ui/globals.css`                                                                                          | 63                |
| `src/app/api/chat/{chat-handler,event-stream}.ts` (+tests)                                                                   | `src/http/`                                                                                                   | 53                |
| `src/app/api/health/health-handler.ts` (+test)                                                                               | `src/http/health-handler.ts`                                                                                  | 53                |
| `src/app/workbench/**` non-route files (specimens, `scenarios.ts`)                                                           | `src/site/workbench/`                                                                                         | 53                |
| `src/core/knowledge/data/*.ts`                                                                                               | `src/profile/knowledge/*.ts` (localized authoring format)                                                     | 52 (EN), 65 (PT)  |
| `src/core/knowledge/ids.ts`                                                                                                  | deleted. Ids become strings validated by referential checks; tool enums are built from the injected knowledge | 52                |
| `src/core/knowledge/knowledge-base.ts`                                                                                       | `core/knowledge/localize.ts` + `validate.ts`; `sourceOf` → `core/assistant/citations.ts`                      | 44 (sourceOf), 52 |
| `src/core/assistant/assistant-event.ts`, `components.ts`                                                                     | `src/core/chat/events.ts`, `src/core/chat/components.ts`                                                      | 58                |
| `MAX_QUESTION_LENGTH` (router) + request schema (handler) + `HistoryTurn` (×2) + `INTERRUPTED` (×3) + `EVENT_TYPES` (client) | `src/core/chat/request.ts`, `request-schema.ts`, `events.ts`                                                  | 58                |
| `src/core/assistant/system1/responses/*.ts` (prose)                                                                          | `src/profile/copy/<locale>/answers.ts` (AnswerSet)                                                            | 54                |
| `src/core/assistant/tools/reference-catalog.ts` (company and technology titles)                                              | `profile/knowledge` (`role.reference`, `references.technologies`)                                             | 54                |
| `src/infrastructure/retrieval/knowledge-index.json`                                                                          | `src/profile/generated/knowledge-index.json`                                                                  | 52                |
| `scripts/evaluation/cases.ts`                                                                                                | `src/profile/evaluation/cases.ts` (the harness stays in `scripts/`)                                           | 52                |
| `src/ui/rich/examples.ts`                                                                                                    | `src/site/workbench/rich-examples.ts`                                                                         | 53                |
| `public/marcio-alves-resume.pdf` (hand-made, tracked)                                                                        | deleted; generated `public/<profile.resume.files[locale]>` (gitignored)                                       | 67                |

---

## 3. Locale routing (FR-6, FR-7, FR-9, FR-15, D2, D3)

### 3.1 Why `[locale]` plus rewrites, and not the alternatives

| Option                                                                           | Verdict                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two route trees with two root layouts (`app/(en)/…`, `app/pt/…`)                 | **Rejected.** Moving between root layouts triggers a full page load. That unmounts the conversation provider, which breaks D5/AC-9.2 (the streaming answer must survive a switch).                                                                                                                                                                       |
| One `app/layout.tsx` that reads the locale from `headers()`                      | **Rejected.** `<html lang>` becomes request-bound, so every page becomes dynamic under `cacheComponents` (the `migrating-to-cache-components` guide says so explicitly).                                                                                                                                                                                 |
| `app/[locale]/layout.tsx` as the root layout, English prefixed `/en`             | It works, but it contradicts D2 (English unprefixed).                                                                                                                                                                                                                                                                                                    |
| **`app/[locale]/layout.tsx` as root layout + `afterFiles` rewrite `/x → /en/x`** | **Chosen.** One root layout whose state key ignores the param value (verified in the Next 16.4 source, §0), so client navigation between `/skills` and `/pt/skills` keeps the providers mounted. `next/root-params` gives the locale to any server component and keeps prerendering. The rewrites docs state that rewrites apply to client-side routing. |
| Same, but with a `proxy.ts` rewrite                                              | Fallback only: it runs a function on every request, before the CDN cache. It stays the plan B if the rewrite spike (§3.6) fails.                                                                                                                                                                                                                         |

### 3.2 Routing table (`next.config.ts`)

```ts
redirects: () => [
  { source: '/en', destination: '/', permanent: true },
  { source: '/en/:path*', destination: '/:path*', permanent: true },
],
rewrites: () => ({
  beforeFiles: [],
  // After the filesystem: /api/*, /sitemap.xml, /robots.txt, /brand/icon.png and
  // public files (the résumé PDFs) are served as they are; only page paths reach here.
  afterFiles: [
    { source: '/', destination: '/en' },
    { source: '/:path((?!pt(?:/|$)|_next/).*)', destination: '/en/:path' },
  ],
  fallback: [],
}),
```

- Redirects run only on the **incoming** URL, so the rewritten internal `/en/…` path is never redirected again.
- The app never emits an `/en/…` URL. Hrefs come from `site/routes.ts`. Image URLs are explicit public URLs (§3.5), never Next's auto-generated metadata-image URLs (those would contain `/en`).
- The exact `source` patterns are pinned by unit tests with `getRewrittenUrl` / `getRedirectUrl` from `next/experimental/testing/server`, run against the real `next.config.ts`: `/`, `/skills`, `/pt`, `/pt/skills`, `/nope`, `/pt/nope`, `/en/skills`, `/api/chat`, `/marcio-alves-resume.pdf`, `/ptx`.

### 3.3 Segments, locales and root params

- `core/i18n/locale.ts`: `SUPPORTED_LOCALES = ['en', 'pt-BR'] as const`, `type Locale`, `DEFAULT_LOCALE = 'en'`, `isLocale()`.
- `site/routes.ts`: `LOCALE_SEGMENT: Record<Locale, 'en' | 'pt'>`, `localeFromSegment(segment): Locale | null`, `pagePath(locale, topic)` (`/`, `/skills`, `/pt`, `/pt/skills`), `counterparts(topic): Record<Locale, string>`, `assetPath(locale, name)`.
- `app/[locale]/layout.tsx` exports `generateStaticParams = () => profile.locales.map(l => ({ locale: LOCALE_SEGMENT[l] }))`, which `site-root` provides. `cacheComponents` requires at least one value per root param, and gets one.
- The `site` code reads the locale with `import { locale } from 'next/root-params'` → `localeFromSegment(await locale())` → `notFound()` when it is null. Root-param getters are cache-key-aware, so pages stay prerendered.
- `<html lang>` is `en` or `pt-BR` (FR-7, AC-7.1, AC-7.2).
- **`profile.locales`** (the enabled subset of `SUPPORTED_LOCALES`) gates `generateStaticParams`, the sitemap, `hreflang` and the switcher. With one locale enabled the switcher does not render and `/pt/*` answers 404. This is how routing (POR-64) and content (POR-65) merge to production before Portuguese is switched on in POR-66 (D30, FR-56). It also lets a forker run an English-only site.

### 3.4 404s (FR-6, AC-6.2)

- `app/[locale]/[...rest]/page.tsx` calls `notFound()` without reading params. `app/[locale]/not-found.tsx` renders `StatusNotice` with copy for `await locale()`. `/nope` → `/en/nope` → English 404. `/pt/nope` → Portuguese 404. Both return status 404, because `notFound()` runs before streaming.
- `/en/skills` → 308 → `/skills`.
- **Spike check** (first step of POR-64): the build output lists the catch-all route and `curl -I /pt/nope` returns 404. Fallback: `globalNotFound` (experimental), with one bilingual page.

### 3.5 Metadata images and icon (FR-15, AC-15.3)

The `opengraph-image.tsx` / `icon.tsx` file conventions would emit `/en/…` URLs. So they become route handlers with explicit metadata:

- `app/[locale]/brand/share-image.png/route.tsx` → `GET` returns `new ImageResponse(shareImage(profile, locale))`. It reads no runtime data, so it is prerendered under `cacheComponents` (a `GET` handler prerenders when it touches no uncached data). Public URLs are `/brand/share-image.png` and `/pt/brand/share-image.png`.
- `app/brand/icon.png/route.tsx` → 64×64 monogram, one for all locales.
- `site/metadata.ts` sets `openGraph.images`, `twitter.images` and `icons` to those URLs, with `width/height/alt` from copy.
- Fonts for images are read at module load from `brand.imageFonts` (unchanged pattern, keeps the render at build).

### 3.6 Spike that opens POR-64 (go/no-go before any page moves)

1. `next build` with `[locale]` + rewrites prerenders `/[locale]`, `/[locale]/skills` and so on for `en` (and `pt` when enabled), plus `[...rest]`.
2. Playwright on the production build: navigate `/experience` → `/pt/experience` → `/experience` with a streaming answer in flight (a mock SSE route under `/workbench` in dev, or the fast path with the reveal running). The answer continues and the provider state survives. **No request URL path starts with `/en/`** (asserted on `page.on('request')`).
3. Prefetch on hover works (`partialPrefetching`) and returns 200 for public URLs.

If 2 fails: switch to the `proxy.ts` rewrite (same `app/` tree, `matcher` excluding `_next`, `api`, `brand/icon.png`, files with an extension). If state still does not survive: escalate. The remaining fallback, persisting conversations in `sessionStorage`, satisfies AC-9.1 but not AC-9.2, which is an owner-level trade-off.

---

## 4. The profile contract (FR-1…FR-5, D9, UC-4)

### 4.1 Files a reuser edits

```
src/profile/
├── README.md                 # the guide (FR-5): every file below, what it holds, and the commands to run after editing
├── index.ts                  # assembles + validates → export const profile: Profile   (no framework imports)
├── schema.ts                 # Profile type (composition of consumer-owned types) + zod data invariants
├── identity.ts               # name, firstName, lastName, initials, pronouns per locale, availability,
│                             #   siteOrigin (fallback only; SITE_URL / Vercel still win), contact
│                             #   {email, linkedin, github}, assistant {name, initials}, userAgentProduct
├── locales.ts                # enabled locales, e.g. ['en'] → ['en', 'pt-BR'] (POR-66)
├── brand.ts                  # colour tokens (every --color-* in the design), font family names,
│                             #   imageFonts {display:{400,600}, text:{400,600}} → @fontsource file paths
├── fonts.ts                  # next/font loaders (the ONLY framework file; imported only by site-root)
├── knowledge/                # localized authoring format (§6.1)
│   ├── profile.ts experience.ts metrics.ts projects.ts skills.ts education.ts
│   ├── principles.ts sources.ts references.ts   # company / technology encyclopedia titles
│   ├── highlights.ts         # which metrics/roles headline where: careerMetrics, evidenceLine {companies, metrics[2]}
│   └── index.ts              # export const knowledge: KnowledgeSource
├── copy/
│   ├── en/   ui.ts site.ts answers.ts resume.ts
│   └── pt-BR/ ui.ts site.ts answers.ts resume.ts     # added in POR-65
├── resume.ts                 # phone (PDF only), file names per locale, section order
├── sites/
│   ├── allow-list.ts         # public sites to ingest (§9)
│   └── snapshot.json         # GENERATED by pnpm sites:ingest (committed)
├── generated/
│   ├── knowledge-index.json  # GENERATED by pnpm rag:build (committed; hash-checked)
│   └── brand.css             # GENERATED by pnpm brand:css (committed; drift-checked)
├── design/scenarios.ts       # the questions that replay the design's state boards (fidelity fixtures)
├── evaluation/cases.ts       # the owner's evaluation cases
├── global-error-copy.ts      # 2 strings per locale; client-safe (imported by app/global-error.tsx)
└── profile.test.ts           # the only test file allowed to name the owner: owner-specific checks
```

### 4.2 Types: owned by their consumers, satisfied by the profile (DIP)

| Part                                                             | Type owner                      | Shape                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knowledge`                                                      | `core/knowledge/schema.ts`      | `KnowledgeSource` (§6.1)                                                                                                                            |
| `copy[locale].answers`                                           | `core/assistant/answer-kit.ts`  | `AnswerSet` (§5.4): topic labels/intros/questions, an answer builder per intent, vocabulary extensions, section labels, the evidence-line formatter |
| `copy[locale].ui`                                                | `ui/i18n/ui-messages.ts`        | `UiMessages`: interface strings, aria labels, empty/error/rate-limited states, switcher labels                                                      |
| `copy[locale].site`                                              | `site/site-copy.ts`             | `SiteCopy`: titles, descriptions, OG/Twitter text, JSON-LD job title/description, 404 copy, share-image strapline                                   |
| `copy[locale].resume`                                            | `scripts/resume/resume-copy.ts` | section headings, "Present", contact labels                                                                                                         |
| `brand`                                                          | `site/site-copy.ts` (`Brand`)   | `{ colors: Record<ColorToken, Hex>; fonts: { text, display, code }; imageFonts }`                                                                   |
| `identity`, `resume`, `locales`, `sites`, `design`, `evaluation` | `profile/schema.ts`             | data                                                                                                                                                |

`Profile = { identity; locales; brand; knowledge; copy: Partial<Record<Locale, LocaleCopy>>; resume; design; evaluation; sitesSnapshot; knowledgeIndex }`.

### 4.3 Validation at build (zod)

`profile/index.ts` ends with `export const profile = validateProfile(raw)`. The module evaluates during `next build` (prerender), `next dev`, every test that reads it, and every script, so an invalid profile fails all four, with zod issue paths. `validateProfile` checks what types cannot express:

- every `Localized` text is non-empty for **every enabled locale**, and every `copy[locale]` exists for every enabled locale. The issue path names the field, e.g. `knowledge.experience[2].highlights[4]['pt-BR']`. This satisfies UC-4 2a and NFR-8;
- ids are unique; every reference resolves (role → metrics, highlights → ids, evidence line → 2 metric ids, sources);
- dates are `YYYY` or `YYYY-MM`, start ≤ end, and at most one role has `end: null`;
- URLs are absolute `https:`; colours are `#rrggbb`; the brand covers every `ColorToken`;
- `project.technologies` is non-empty ⇒ `technologiesSource` is set (FR-27);
- `resume.phone` matches E.164, and the knowledge source cannot carry a `phone` key (NG11);
- the `sitesSnapshot` passages reference allow-listed URLs only.

Type-level contracts stay primary: `AnswerSet` must define every intent, and `UiMessages` every key, both enforced by `tsc`.

### 4.4 Brand colours and fonts → Tailwind v4 tokens (FR-3, AC-3.1)

- `scripts/generate-brand-css.mts` renders `@theme { --color-<token>: <hex>; … --font-sans: var(--font-face-text), <fallbacks>; --font-display: …; --font-mono: …; }` from `brand.ts` into `src/profile/generated/brand.css`, prefixed with a "generated, do not edit" banner. `pnpm brand:css` runs it.
- `src/ui/globals.css` keeps every non-brand token (type scale, radii, shadows, motion, keyframes) and adds `@import '../profile/generated/brand.css';` after `@import 'tailwindcss';`. Tailwind v4 merges multiple `@theme` blocks. Shadows that mix ink with alpha (`rgb(15 17 21 / 0.03)`) become `color-mix(in srgb, var(--color-ink) 3%, transparent)`, which is pixel-equal in sRGB. The fidelity gate proves it in POR-63.
- Test `profile/generated/brand-css.test.ts`: `render(brand) === readFile('brand.css')`, failing with "run pnpm brand:css". It replaces `app/brand-colors.test.ts`. The share image, icon and PDF import `brand.ts` directly, so the values have a single source.
- Fonts: `profile/fonts.ts` calls the `next/font/google` loaders (literal options, as `next/font` requires) with the generic variables `--font-face-text`, `--font-face-display` and `--font-face-code`, and exports `fontClassName`. Only `site-root.ts` and `app/global-error.tsx` import it (see POR-53 as built). `profile/index.ts` never does, so scripts and tests never evaluate `next/font`.
- No hand-written CSS outside the token layer and no inline `style` on `<html>`. CSP is unchanged.

### 4.5 The whitelabel test (FR-2, AC-1.1, AC-4.2)

`src/architecture/whitelabel.test.ts` (node project):

- **Terms**, all derived from `profile`, so the test works for any profile:
  - identity: full name, first and last name, email, LinkedIn/GitHub URLs and handles, site host, phone;
  - companies (`role.company` plus `role.aliases`), product names, school names;
  - all compared case-sensitively at word boundaries. `identity.nonIdentifyingTerms` lists generic words to skip (for example `Freelance`).
- **Metric values and years** (from knowledge dates) apply only to string and template literals in `src/core/**` (not tests). That gives AC-4.2 without false positives such as `50%` in CSS.
- **Scope**: `git ls-files` under `src/`, `scripts/`, `e2e/` and `public/`. It excludes `src/profile/**`, `src/testing/fixture-profile/**` and binary files. Generated PDFs are gitignored, so they are never scanned.
- **Failure output**: `file:line: "Deel" (company)`, which satisfies UC-4 3a.
- **Fixture assertion**: no fixture-profile term overlaps an owner term.
- Rollout: introduced in POR-52 scoped to the moved files. POR-54 widens it to `src/core`. POR-63 widens it to the full scope.

### 4.6 Fixture profile and owner-agnostic tests (UC-4 step 3)

- `src/testing/fixture-profile/` is a complete fictional `Profile` (both locales, a different name, colours and contact, three roles, one contract role, one concept project, a site snapshot of two passages, its own `AnswerSet`s written to exercise every intent).
- **Core, http, site and ui unit tests use the fixture.** Tests that need the real profile assert only **generic properties**: the suggestion graph closes, every topic question is answered by the fast path, the translation integrity holds, the index hash matches. They contain no literals.
- **E2E reads expectations from `profile`** (names, topic questions, the counterpart labels), so a forker's e2e passes against their profile.
- `src/profile/profile.test.ts` is the one place owner literals may appear (for example "the evidence line names Toptal, Deel, Roots"). It is excluded from the scan.

### 4.7 AC-1.2 (fixture end to end)

`src/site/create-site.test.tsx` builds `createSite(fixtureProfile, { fontClassName: '' })`. It renders `homePage` and `RootLayout` for both locales with `renderToStaticMarkup`/RTL, and asserts the title, welcome heading, contact card, JSON-LD and share-image element text against fixture values. A full `next build` with the fixture is not needed: the roots are the only place the real profile is bound, and they are three lines.

---

## 5. Internationalisation architecture

### 5.1 Catalog format and typing

- **Interfaces are owned by consumers** (§4.2). EN and PT files are each typed `: UiMessages` / `: SiteCopy` / `: AnswerSet`. A missing key is a `tsc` error. `profile/catalogs.test.ts` additionally deep-compares key sets for every enabled locale and prints the missing paths (AC for NFR-8 and UC-4 2a, readable for a forker).
- **Plain strings** for fixed text. **Templates** use `{name}` placeholders. **Plurals** are objects keyed by `Intl.PluralRules` categories:

  ```ts
  type Template = string; // "View {company} experience"
  type Plural = { readonly other: Template } & Partial<Record<Intl.LDMLPluralRule, Template>>;
  // core/i18n/format.ts
  export function interpolate(template: Template, values: Record<string, string | number>): string;
  export function plural(
    locale: Locale,
    message: Plural,
    count: number,
    values?: Record<string, string | number>,
  ): string;
  ```

  These are framework-free and serializable, so the client receives them as data. ICU MessageFormat is not needed. If a select or ordinal ever appears three times, revisit.

- **Copy functions are allowed only in server-side copy** (`answers.ts`, `site.ts`, `resume.ts`), where prose wraps facts: `intro: (k) => \`${k.profile.firstName} is…\``. `ui.ts` contains data only, because it crosses to the client.
- **Missing-key test:** the type check plus `catalogs.test.ts`. A raw key or `{placeholder}` leaking into the DOM is caught by an e2e assertion on every page and state: no text matches `/\{[a-zA-Z]+\}/`. This is part of AC-7.1.

### 5.2 Server components

`site/*` builders receive `(profile, locale)`. `createSite` resolves `copy = profile.copy[locale]` once per call. No async loading is needed: catalogs are static imports evaluated at build into prerendered HTML.

### 5.3 Client components

- `app/[locale]/layout.tsx` renders `<I18nProvider locale={locale} messages={profile.copy[locale].ui}>`. That is one locale, a few KB of strings, gzipped about 1.5 KB.
- `useMessages()` / `useLocale()` read it. `ui` components never import a catalog module.
- `error.tsx` sits inside the layout and uses `useMessages()`. `global-error.tsx` replaces the layout: it derives the locale from `usePathname()` (`/pt` prefix) and imports `profile/global-error-copy.ts` (two strings per locale, client-safe).
- **Rule for answers:** everything **inside** an answer is in the answer's language, resolved by core, including role-badge labels, section titles inside rich blocks, and the project card's "Platforms" / "Key features". Everything **around** it (actions, "Sources", the composer, status) is in the page's language from `UiMessages`. Rich-component props therefore carry resolved labels: `RoleView.badges: {kind: 'current' | 'contract', label}[]`, `ProjectView.labels: {scope, platforms, technologies, links}`.

### 5.4 Core: localized fast path without Next (FR-4, FR-10, FR-12)

```ts
// core/assistant/answer-kit.ts
export interface AnswerKit {
  // bound to (knowledge[locale], copy, locale)
  readonly locale: Locale;
  readonly k: Knowledge; // monolingual view
  readonly format: {
    period(role): string;
    monthYear(ym): string;
    list(items): string;
    number(n): string;
  };
  text(md: string): ResponsePart;
  metrics(ids: readonly string[]): ComponentPart;
  timeline(ids?: readonly string[]): ComponentPart;
  skills(ids?): ComponentPart;
  projects(ids?): ComponentPart;
  table(cols, rows, caption?): ComponentPart;
  note(tone, md): ComponentPart;
  details(summary, md): ComponentPart;
  contactOnce(ctx: ConversationContext): ComponentPart | null;
  response(intent, parts, meta): AssistantResponse;
}
export type AnswerBuilder = (
  kit: AnswerKit,
  ctx: ConversationContext,
  question: string,
) => AssistantResponse;
export interface AnswerSet {
  readonly topics: Record<
    TopicId,
    { label; intro: (kit) => string; questions: readonly TopicQuestion[] }
  >;
  readonly answers: Record<
    ScoredIntent | 'greeting' | 'identity' | 'privateInfo' | 'offPurpose' | 'unknown' | 'slowDown',
    AnswerBuilder
  >;
  readonly company: AnswerBuilder; // receives role id via ctx-free param in kit call
  readonly project: AnswerBuilder;
  readonly technology: AnswerBuilder;
  readonly labels: { roleSections; badges; projectSections; topicData }; // strings inside answers
  readonly vocabulary: Partial<Record<ScoredIntent, readonly Rule[]>>; // owner words, e.g. /\bhris\b/
  readonly evidenceLine: (kit) => string;
}
// core/assistant/system1/fast-path.ts
export function createFastPath(deps: {
  knowledge: Record<Locale, Knowledge>;
  answers: Record<Locale, AnswerSet>;
}): {
  answer(question: string, ctx: ConversationContext, pageLocale: Locale): FastPathResult;
  followUpsFor(intent: ScoredIntent | null, ctx, locale: Locale): readonly string[];
};
```

- **Core keeps** the fixed intent set (`SCORED_INTENTS`, renamed generically where it named owner specifics: `hrisRole → leadRole`, `staffFit → roleFit`, `quality → qualityImprovement`), the scoring engine, the guards, compound/definition/task detection, and **generic language rules per locale** (`system1/rules.en.ts`, `rules.pt-BR.ts`). Generic English and Portuguese words are product vocabulary, not owner data.
- **The profile supplies** every answer's prose (as builders over the kit), topic copy, the owner-specific vocabulary (`/\bhris\b/`, `/\bufpb\b/`), and which metrics headline where.
- **Derived from knowledge, not written:** company patterns come from `role.company` plus `role.aliases`. That is one definition (FR-47), and it also feeds `COMPANY_PROFILE`. Project names come from `projects[].name`, technologies-with-evidence from the record (`technologies.ts` keeps the generic technology list).
- **Question language** (`core/assistant/language.ts`): `detectLanguage(text): 'en' | 'pt-BR' | 'other' | 'ambiguous'`. It scores marker sets (PT: accents `[ãõçâêôà]`, stop-words `ele, dele, qual, como, onde, já, são, trabalhou, experiência…`; EN: `he, his, what, how, does, did, the…`; ES markers → `other`). With no markers (`React?`) the result is `ambiguous`, which falls back to the page locale (D4, AC-10.3). `other` escalates to the model, as today.
- **Answer locale** = the detected language, or the page locale when ambiguous. The fast path uses `answers[answerLocale]`, `knowledge[answerLocale]` and that locale's rules. Follow-ups are in the answer's language.
- **Authoring constraint, enforced by test:** every suggested question and follow-up in locale L is detected as L, never `ambiguous`. Otherwise an ambiguous PT suggestion asked on an EN page would answer in English (AC-10.1, AC-10.2).

### 5.5 Model path locale (FR-11)

- The request carries `locale` (page locale). `ModelAssistantRequest` gains `pageLocale`.
- The system prompt is still written in English and parameterized by `identity` (name, pronouns), never with literals. It gains: _"The visitor is reading the {English | Brazilian Portuguese} version of the site. Reply in the language of the visitor's latest message. When that language cannot be told (a single word, a name, a technology), reply in {page language}."_
- **Tools return the page locale's knowledge.** Cards render in the page language. The model translates facts when the question's language differs, and the judge already accepts faithful translation.
- **Answer-cache key** becomes `${pageLocale}:${normalize(question)}`. Otherwise an ambiguous question cached on one locale's page would replay on the other.

### 5.6 Formatting (FR-16, AC-16.1)

- `core/i18n/format.ts`:
  - `monthYear(ym, locale)` uses `Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).formatToParts` and joins only the month and year parts. That gives `Mar 2026` and `mar. 2026`; the plain `pt-BR` format would be `mar. de 2026` (§15-1).
  - Year-only dates print the year.
  - `period(start, end, locale, presentLabel)` → `Mar 2026 — Present` / `mar. 2026 — atual`.
  - `number(n, locale)`.
- Metric `value` strings stay shared (FR-13). Computed numbers (years, counts) go through `number()`.

---

## 6. Knowledge model, retrieval and prompt

### 6.1 Authoring format (`KnowledgeSource`) and runtime view (`Knowledge`)

```ts
type Localized = { readonly en: string } & Partial<Record<Exclude<Locale, 'en'>, string>>;
type YearMonth = `${number}` | `${number}-${number}`; // '2022' | '2026-03'
interface RoleSource {
  id: string;
  company: string;
  aliases?: readonly string[]; // names are not translated (D25)
  title: string; // résumé job title, untranslated (D25)
  start: YearMonth;
  end: YearMonth | null;
  engagement: 'employment' | 'contract';
  summary: Localized;
  responsibilities: readonly Localized[];
  leadership: readonly Localized[];
  achievements: readonly Localized[];
  focus: readonly Localized[];
  metrics: readonly string[];
  highlights: readonly Localized[];
  source: string;
  reference?: { encyclopediaTitle: string };
}
// MetricSource { id; value: string (shared); label: Localized; context: string; source }
// ProjectSource { id; name; status: 'live' | 'preview' | 'beta' | 'concept'; category: Localized; description: Localized;
//                 scope: Localized[]; platforms: Localized[]; technologies: string[]; technologiesSource?: {url};
//                 links: {label: Localized; url}[]; repository?: url; outcomes?: Localized[]; source }
```

- `localize(source, locale): Knowledge` is pure. The `Knowledge` shape matches today's monolingual types (with `period` computed by `format`), so the change to core code is mostly mechanical.
- `isConcurrent` and the fractional `start/end` numbers are deleted (D19). The roles stay newest first, validated by date order (FR-28: Toptal first).
- `sources.ts`: labels are `Localized` (`Resume` / `Currículo`).

### 6.2 Corpus (bilingual, FR-14)

- `buildCorpus(source, sitesSnapshot)` emits, for **each locale present in the source**, the same passages as today with ids prefixed `en/…` and `pt-BR/…`, plus the site passages (`site/<projectId>/<n>`) in the language the site itself is written in.
- `KnowledgeChunk` gains `locale` and `kind: 'record' | 'product-site'`.
- `corpusHash` covers all of them (AC-14.1).

### 6.3 Retrieval

- `VectorKnowledgeSearch.search({ query, limit, category?, signal })` scores every chunk, groups by **base id** (the id without the locale prefix), keeps the best-scoring language version, applies `RELEVANCE_FLOOR`, and slices.
- The same fact in two languages therefore cites one source and never fills two of the `limit` slots (FR-14: "cites the same sources").
- The floor (0.22) was calibrated on EN and PT queries already; POR-65 re-checks it in `vector-knowledge-search.test.ts` against the real index (a PT query about Deel returns Deel passages, AC-14.1).

### 6.4 Index location

The index is profile-derived, so it moves to `src/profile/generated/knowledge-index.json`. `composition-root` imports it and passes it to `createVectorKnowledgeSearch` (infrastructure never imports the profile). `pnpm rag:build` writes there. D29's serial rule stands.

### 6.5 Product-vs-person (FR-26)

This is designed in §9.5.

---

## 7. Dependency rules and contracts (FR-43, FR-44, FR-46)

### 7.1 `.dependency-cruiser.cjs` (target; staged clauses noted)

| Rule                                                               | from                                                                                       | to (forbidden)                                                                                   | Note                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `core-is-framework-free`                                           | `^src/core` (not tests)                                                                    | any npm except `zod`                                                                             | unchanged                                                                                                               |
| `core-is-innermost`                                                | `^src/core`                                                                                | `^src/(app\|http\|site\|ui\|infrastructure\|profile\|testing\|composition-root\|site-root\|env)` | fixes the dead `components` name                                                                                        |
| `knowledge-is-below-assistant`                                     | `^src/core/(knowledge\|i18n)`                                                              | `^src/core/(chat\|assistant\|conversation)`                                                      | FR-44, AC-44.1                                                                                                          |
| `chat-contract-is-below-engine`                                    | `^src/core/chat`                                                                           | `^src/core/(assistant\|conversation)`                                                            | POR-58                                                                                                                  |
| `ui-is-presentation`                                               | `^src/ui`                                                                                  | `^src/(app\|http\|site\|infrastructure\|profile\|composition-root\|site-root\|env)`              | POR-44                                                                                                                  |
| `ui-reads-contracts-only`                                          | `^src/ui`                                                                                  | `^src/core/(knowledge\|assistant)`                                                               | **added in POR-59**, when the last import goes                                                                          |
| `site-is-profile-agnostic`                                         | `^src/site`                                                                                | `^src/(infrastructure\|http\|profile\|composition-root\|app)`                                    | POR-53                                                                                                                  |
| `http-is-injected`                                                 | `^src/http`                                                                                | `^src/(app\|ui\|site\|profile\|infrastructure\|composition-root\|site-root)`                     | POR-53 (`client-key.ts`, created by POR-45, is the only file there before)                                              |
| `infrastructure-is-a-plugin`                                       | `^src/infrastructure`                                                                      | `^src/(app\|http\|site\|ui\|profile\|composition-root\|site-root)`                               | FR-43                                                                                                                   |
| `app-goes-through-roots`                                           | `^src/app`                                                                                 | `^src/(infrastructure\|core)`; `^src/profile` except `profile/global-error-copy`                 | `infrastructure` clause in POR-44; `core` and `profile` clauses in POR-53 (the app helpers import core until they move) |
| `profile-is-configuration`                                         | `^src/profile`                                                                             | `^src/(app\|http\|infrastructure\|composition-root\|site-root\|env\|testing)`                    | POR-52                                                                                                                  |
| `profile-uses-only-types-outward`                                  | `^src/profile`                                                                             | `^src/(ui\|site)` with `dependencyTypesNot: ['type-only']`                                       | POR-52; values forbidden, types allowed                                                                                 |
| `only-roots-read-the-profile`                                      | `^src` minus `(profile\|testing\|composition-root\|site-root\|app/global-error)` and tests | `^src/profile`                                                                                   | POR-52, with `src/app` temporarily allowed; POR-53 removes the exemption                                                |
| `fixtures-only-in-tests`                                           | `^src` non-test                                                                            | `^src/testing`                                                                                   |                                                                                                                         |
| `src-never-imports-scripts`                                        | `^src`                                                                                     | `^scripts`                                                                                       |                                                                                                                         |
| existing `no-circular`, `not-to-unresolvable`, `no-dev-dep-in-src` |                                                                                            |                                                                                                  | `no-dev-dep-in-src` also exempts `src/testing`                                                                          |

- **Boundary fixtures (AC-43.1):** `src/architecture/boundaries.test.ts` calls `cruise(['src'], { ruleSet, baseDir })` from dependency-cruiser's API on `src/architecture/fixtures/<rule>/src/**`, one tiny tree per forbidden edge. It asserts each rule name fires. The fixtures sit under a folder excluded from the main `depcruise src` run (`options.exclude`).
- `pnpm boundaries` stays `depcruise src`.

### 7.2 The cycle fix (POR-44)

`knowledge-base.ts#sourceOf` (the only `knowledge → assistant` edge) moves to `core/assistant/citations.ts#citation(id, knowledge)`. `knowledge` exposes `sourceLabel(id)`. Its callers (response kit, knowledge tools, evidence report, vector search adapter) import from `assistant`. That is inward, so it's legal.

### 7.3 Server-only guards

- `server-only` is added as a runtime dependency. `import 'server-only'` goes at the top of `composition-root.ts`, `site-root.ts` and `env.ts`. A client module that reaches any of them fails `next build` (AC-43.1, second half).
- `vitest.config.mts` aliases `server-only` → `src/testing/empty-module.ts`. The scripts that import the roots (`rag:build`, `eval:assistant`) run `tsx --conditions=react-server`, which resolves the empty export. They do not render React, so the condition is harmless. The résumé, brand-CSS and ingestion scripts import only `@/profile` and `@/core`, which are unguarded and framework-free.
- **Client reachability test** (`src/architecture/client-boundary.test.ts`): it cruises `src` to JSON, collects every module whose source starts with `'use client'`, walks its transitive imports, and fails if any path reaches `profile/` (except `global-error-copy`), `core/knowledge`, `core/assistant`, `infrastructure/`, `http/`, `site/` or the roots. This catches a KB leak even when no `server-only` file is on the path.
- **Bundle scan (AC-45.1)** in `e2e/bundle.spec.ts` (production build): it loads `/` and `/experience`, collects every same-origin `script` response, and asserts none contains a knowledge-only sentence (a highlight taken from `profile`). The same spec measures first-load JS (§12, POR-59).

### 7.4 Single definitions (FR-46)

| Contract                                                                                              | One definition                  | Imported by                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| `ASSISTANT_EVENT_TYPES`, `AssistantEvent`, `AssistantError`, `AssistantErrorCode` (+ `'interrupted'`) | `core/chat/events.ts`           | core, http, ui                                 |
| `INTERRUPTED` (`{ type: 'error', error: { code: 'interrupted', retryable: true } }`)                  | `core/chat/events.ts`           | assistant, event-stream, chat-client           |
| `RichComponent`, `RICH_COMPONENTS`, view types                                                        | `core/chat/components.ts`       | assistant, ui                                  |
| `HistoryTurn`, `ConversationContext`, `MAX_QUESTION_LENGTH`, `MAX_HISTORY_TURNS`, `MAX_HISTORY_TEXT`  | `core/chat/request.ts` (no zod) | conversation, assistant, ui, schema            |
| `chatRequestSchema` (zod)                                                                             | `core/chat/request-schema.ts`   | http only (zod stays out of the client bundle) |
| `AnswerSource`                                                                                        | `core/chat/events.ts`           | knowledge never; assistant builds it           |

- Error **messages** leave the wire: the UI renders text by `code` from `UiMessages` (localized FR-7 error states). The server keeps logging its own detail.
- The request schema:

```ts
z.strictObject({
  message: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  locale: z.enum(SUPPORTED_LOCALES).default('en'), // tolerant during a deploy
  history: z
    .array(
      z.strictObject({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(MAX_HISTORY_TEXT),
      }),
    )
    .max(MAX_HISTORY_TURNS * 2)
    .default([]),
  context: z
    .strictObject({
      topic: z.enum(TOPIC_IDS),
      lastIntent: z.string().max(80).nullable(),
      ctaShown: z.boolean(),
    })
    .default({ topic: 'overview', lastIntent: null, ctaShown: false }),
});
```

---

## 8. Robustness designs

### 8.1 Bounded limiter and budget memory (FR-36, AC-36.1)

`createSlidingWindowLimiter({ limit, windowMs, maxKeys = 50_000, now })`:

- On every `admit`, if `at - lastSweep >= windowMs`, iterate the map once and delete every key whose newest timestamp is `<= at - windowMs`. This is amortized O(1) per request, and memory is bounded by the clients active within one window.
- **Hard cap:** if a new key would exceed `maxKeys`, evict the oldest-inserted key (`Map` iteration order). This protects against a key flood within a single window; log `limiter.evicted` once per sweep.
- The model budget reuses the limiter, so it inherits both. Its daily counter is a scalar (already bounded).
- Test: 10,000 distinct keys at t0, then one request at t0 + window + 1 → `size() === 1`. A `size()` accessor is exposed for tests and the health check.

### 8.2 Client key with IPv6 /64 (FR-37, AC-37.1)

- `http/client-key.ts#clientKey(raw: string): string`:
  - trim; strip brackets, ports and zone ids (`%eth0`);
  - `net.isIPv4` → as is;
  - IPv4-mapped (`::ffff:a.b.c.d`) → the IPv4;
  - `net.isIPv6` → expand `::`, take the first four hextets, emit `xxxx:xxxx:xxxx:xxxx::/64`;
  - anything else → `'unknown'`.
- `clientIdOf(request)` applies it to `x-real-ip`, then the first non-blank `x-forwarded-for` entry.
- Tests: `2001:db8:1:2::a` and `2001:db8:1:2::b` give the same key; `2001:db8:1:3::a` gives a different one; also compressed forms, mapped v4 and garbage.

### 8.3 Interrupted tokens (FR-38, AC-38.1)

- OpenAI reports usage only in the final stream chunk (`include_usage`), so an aborted or failed round reports nothing today.
- The port gains a `{ type: 'started' }` event, yielded by the adapter as soon as `chat.completions.create(…)` resolves: from then on the call may be billed. A rejected `create()` (open circuit, 4xx/5xx, connection failure) yields nothing and is not charged. The adapter yields `finish` only when a usage chunk arrived; it never reports a missing usage as zero.
- In `core/assistant/system2/usage.ts`, a meter per round notes the `started` event and any reported usage. In the round's `finally`, if the call was started and no usage was reported, it calls `onUsage({ inputTokens: estimateTokens(sentChars), outputTokens: maxOutputTokens, estimated: true })`, where `sentChars` is the serialized messages plus tool definitions and `estimateTokens(chars) = Math.ceil(chars / 3)` deliberately **over-estimates** input (EN ≈ 4 chars/token, PT and JSON ≈ 3–3.5).
- **Implemented deviation (POR-45):** the output side is the round's ceiling (`MAX_OUTPUT_TOKENS`), not `receivedChars / 3`. A call cut short may already have generated tokens it never delivered, and those are billed; the provider can never bill more than the ceiling, so input/3 + ceiling is a sound upper bound. `receivedChars / 3` also fell short of the AC bound, because the wire body carries provider framing (~850 chars on the current prompt) that the core never sees. Cost: an abandoned round may be over-counted by up to 700 output tokens.
- It is logged as `model.usage_estimated`. This covers visitor-left (generator `return()`), deadline, idle-timeout, provider errors mid-stream — including a round that was only streaming tool-call fragments — and a stream that ended without a usage chunk.
- AC-38.1 accepts "reduced by at least the tokens consumed (estimated)".

### 8.4 Embeddings: timeout, abort, breaker; tool exceptions (FR-39)

- **Ports:**
  - `EmbeddingPort.embed(texts, signal?)`;
  - `KnowledgeSearchPort.search({ …, signal })`;
  - `Tool.run(raw, signal?)` and `ToolRegistry.run(name, raw, signal?)`.
    The model assistant passes its request signal to every tool.
- **Adapter:** `client.embeddings.create(body, { signal: AbortSignal.any([signal, AbortSignal.timeout(EMBEDDINGS_TIMEOUT_MS = 4_000)]), maxRetries: 0 })`. The answer is waiting on this call, so it does not retry.
- **Breaker:** a separate instance (bulkhead: an embeddings outage must not open the chat-model circuit) with threshold 3 and a 30 s cooldown. `circuit-breaker.ts` gains `guard<T>(breaker, call: () => Promise<T>): Promise<T>`, next to the streaming `withCircuitBreaker`. Cancellation releases the breaker without counting a failure (same rule as today). `/api/health` reports `retrieval: closed | open | half-open`.
- **Tool exceptions:** `defineTool().run` wraps `execute` in try/catch → `{ ok: false, error: 'The action failed: <tool-safe message>.' }`, plus a call to the injected `reportError` (never the raw error text to the model). `searchKnowledge` turns `CircuitOpenError` or a timeout into `{ passages: [], note: 'Search is unavailable right now; answer only from other actions or decline.' }`. Degradation therefore matches AC-39.1: the model answers without retrieval, and the fast path is unaffected.

### 8.5 GitHub and Wikipedia adapters (FR-40)

- Zod schemas (`userSchema`, `repositoriesSchema`, `summarySchema`) live in the adapter. They are tolerant readers (`.passthrough()` is unnecessary; zod strips unknown keys by default).
- On non-OK status, parse failure, timeout or network error, the adapter calls the injected `report({ adapter, operation, status?, cause })` → `logger.warn('adapter.degraded', …)` and then returns the existing degraded `null`. The casts disappear.
- `userAgent` comes from `identity.userAgentProduct` + `siteUrl()`, with no literal.

### 8.6 SSE heartbeat and overall time limit (FR-41, AC-41.1)

- `http/event-stream.ts#eventStream(events, { heartbeatMs = 15_000, deadline: AbortSignal, reportError })`:
  - `pull()` races `iterator.next()` against a heartbeat timer. Each tick enqueues the comment frame `: keep-alive\n\n` and re-arms, until `next()` settles.
  - When `deadline` aborts: `iterator.return()`, enqueue `INTERRUPTED`, close.
  - A generator error enqueues `INTERRUPTED` (as today).
  - `cancel()` returns the iterator.
- `chat-handler`: `const deadline = AbortSignal.timeout(settings.chatRequestTimeoutMs)` (new `CHAT_REQUEST_TIMEOUT_MS`, default 60,000). The assistant receives `AbortSignal.any([request.signal, deadline])`, so model calls stop at the limit, and `eventStream` gets `deadline` so the visitor sees the interrupted event.
- `assistant.ts`, when `signal.aborted`: if the **deadline** fired, rethrow so the stream emits `INTERRUPTED`; if the **visitor** left, end silently. The handler passes both signals: `{ visitor: request.signal, deadline }`.
- `app/api/chat/route.ts`: `export const maxDuration = 75` (above the 60 s limit, so the platform never kills the function first). `maxDuration` is allowed under `cacheComponents`; only `dynamic`, `revalidate`, `fetchCache` and `dynamicParams` are not. **POR-60 must verify** this on a preview deploy.
- Heartbeats reset the client's 30 s idle timer, because `frames()` calls `onChunk()` per read.

### 8.7 Client SSE parser (FR-48, AC-48.1)

The parser is extracted to `ui/chat/sse-parser.ts`: a pure `createSseParser()` with `push(bytes): string[]` and `end(): string[]`, used by `chat-client.ts`.

- `TextDecoder` with `stream: true`, and a final `decoder.decode()` flush in `end()` (a multi-byte character split across chunks).
- Normalize `\r\n` and lone `\r` to `\n`. A trailing `\r` at a chunk end is held until the next chunk (CRLF split across chunks).
- Frames split on a blank line. In `end()` the remaining buffer is parsed as a final frame (no trailing blank line).
- Lines: `data:` strips **one** optional leading space (spec), and multiple `data:` lines join with `\n`. Comment lines (`:`) are ignored. `event:`, `id:` and `retry:` are ignored but tolerated.
- Each of the four cases gets a test (AC-48.1), plus a heartbeat-only stream.

### 8.8 Link allow-list (FR-34, AC-34.1)

- `core/assistant/system2/link-filter.ts#createLinkFilter(isAllowed: (url) => boolean)` is a streaming transformer with the offer filter's `push/flush` shape, chained after it.
- It holds text from a `[` until the matching `](…)` closes, or until 2,048 chars or a newline arrive (then it releases the text as is).
- A link whose URL is not allowed becomes its label alone. Bare `https?://` URLs that are not allowed are kept as text: the UI's inline formatter does not auto-link, and a test pins that.
- **Allowed set:** the knowledge base's URLs (contact, project links, repository, site-snapshot URLs), passed as `knownUrls` by the composition root; plus every URL in a tool result (the `sources[].url` and any `https?://` string found by walking `result.data`), accumulated per answer.
- URLs are compared normalized (`new URL`: protocol and host lower-cased, trailing slash dropped, hash dropped).
- Defense in depth: the UI still refuses non-`http(s)`/`mailto` schemes.

---

## 9. Product-site ingestion (POR-56; FR-25…FR-27, NFR-5, NG8)

### 9.1 Allow-list (profile content)

```ts
// src/profile/sites/allow-list.ts
export const siteAllowList: readonly SiteEntry[] = [
  {
    subject: { kind: 'project', id: 'evcopilot' },
    urls: ['https://evcopilotapp.io/'],
    render: 'static',
    termsNote: "Owner's product; reviewed 2026-10-28",
  },
  // formdaily, targup, and the public "about" pages of the record's companies, one entry each
];
```

Only exact URLs are fetched (no crawling or link-following, NG8). `render: 'browser'` uses Playwright's Chromium (already a dev dependency) for a client-rendered site.

### 9.2 Fetch (`scripts/ingest-sites.mts`)

- **User-Agent:** `${identity.userAgentProduct}-ingest/1.0 (+${siteOrigin})`.
- **robots.txt per origin:** timeout 10 s; parsed with `robots-parser`; `isAllowed(url, ua)` must be true. A robots fetch failure (other than 404) **aborts that origin**, because an unknown policy means do not crawl. `Crawl-delay` is honoured; minimum 1 s between requests to the same host.
- **Page fetch:**
  - `AbortSignal.timeout(15_000)`, `redirect: 'manual'`. Redirects are followed only within the same allow-listed origin, at most 3.
  - The response must be `text/html` and under 2 MB (stream-counted).
  - One retry with 2 s backoff, on 5xx or network errors only.
- **Extraction:** `jsdom` → `@mozilla/readability` → `textContent`; whitespace normalized; language from `<html lang>` (defaulting to the subject's locale). A page with under 200 extracted chars **fails the run** and names it ("renders client-side; set render: 'browser'").

### 9.3 Chunking and snapshot

- Split into paragraphs, then merge into passages of 400–900 chars at sentence boundaries.
- Drop exact-duplicate passages across pages (headers, footers) and passages under 80 chars.
- Output `src/profile/sites/snapshot.json`: `{ generatedAt, entries: [{ id: 'site/<subjectId>/<n>', subject, url, fetchedAt: 'YYYY-MM-DD', language, text }] }`, sorted deterministically, so re-running unchanged sites yields a clean diff.
- Validation (`validateProfile`): every `url` is allow-listed, and every `id` is unique.

### 9.4 Embedding and refresh

`pnpm sites:ingest` (network, no key) → review the diff → `pnpm rag:build` (key) → commit both (IDX, serial). The snapshot and index are static imports, so `next build` never fetches. Structural guarantees for AC-25.2: `src-never-imports-scripts`, plus a test that the snapshot JSON is imported only by `core/knowledge/corpus` via the composition root. The CI build already runs without secrets. §15-2 notes an optional `--network=none` container build step.

### 9.5 Product-vs-person, enforced at four layers (FR-26, AC-26.x)

1. **Data:** site chunks are `kind: 'product-site'` with category `product-sites`. Their corpus text starts with `"From the public website of <product> (<host>), describing the product itself:"`.
2. **Tool:** `searchKnowledge` returns `{ text, category, about: 'product', note: 'Describes the product, not his role or results.' }` for those passages. Their source is `{ id: 'site:<id>', label: '<host>', url }`, so it shows the site URL (AC-26.2).
3. **Prompt:** a grounding rule: _"Passages about a product's website describe what the product does. Never present them as what {name} built, decided or achieved. His role on a product is only what his record states; if it does not state it, say his specific role is not documented."_
4. **Evaluation:** cases "What did he build at EvCopilot?" and its PT twin carry `avoids` built from site claims (feature phrases). "What is FormDaily?" expects `mentions` plus the site source.

The fast path keeps the record's product cards.

### 9.6 Stack only when stated (FR-27)

- `ProjectView.technologies` is empty unless the profile sets `technologies` with `technologiesSource` (the record, or a snapshot URL). The owner curates this from the ingested text.
- `ui/rich/projects.tsx` renders the row only when it is non-empty (test: absent, not empty).

---

## 10. Résumé PDF (POR-67; FR-28, FR-29, NG11)

- **Library: `@react-pdf/renderer` v4.**
  - It has a flexbox layout engine and wraps, breaks and paginates text. `pdfkit` (its engine) would mean hand-positioning; `pdf-lib` has no layout; a headless browser is unavailable on a Vercel build.
  - It renders in Node with `renderToBuffer`. Fonts are registered as static WOFF weights from `@fontsource/inter` (new dependency) and `@fontsource/inter-tight` (latin subset; it covers Portuguese diacritics). Variable fonts are unsupported, so static files are used.
  - Its React 19 peer range is checked at install. Fallback: the same document written against `pdfkit` directly.
- **Placement:** `scripts/resume/` (document component, copy types) + `scripts/generate-resume.mts`. It runs in **plain Node via `tsx`**, outside Next's bundler. It imports `@/profile` and `@/core` only.
- **Wiring:** `"build": "pnpm resume:build && next build"`, `"dev": "pnpm resume:build && next dev"`. `resume:build` writes `public/${profile.resume.files[locale]}` for each enabled locale (EN keeps today's `/marcio-alves-resume.pdf`; PT is `/pt/marcio-alves-curriculo.pdf`). Those paths are **gitignored**. Static files are served before the `afterFiles` rewrites (§3.2).
- **Content:** from `localize(knowledge, locale)` plus `copy[locale].resume` plus `resume.phone`:
  - roles newest first (validated);
  - titles and company names exactly as written (D25);
  - typos are fixed in the source data in POR-55, so they cannot reappear (AC-29.1);
  - deterministic metadata (`creationDate` fixed to the knowledge's latest date, `producer` from identity), so builds are reproducible.
- **Links:** `site/workspace-view` passes `resumeUrl = assetPath(locale, files[locale])` (AC-28.2).
- **Phone isolation (NG11, AC-29.2):**
  - `resume.phone` is not part of `Knowledge`, so neither core nor the client can read it;
  - the whitelabel scan includes the phone;
  - `e2e/bundle.spec.ts` asserts it is absent from HTML and scripts;
  - the fast path's `privateInfo` covers "phone number" (this already works, and a test pins it).
- **Tests:** `scripts/resume/resume.test.ts` renders both locales with the fixture profile and extracts text with `pdfjs-dist` (legacy build, dev dependency). It asserts phone present, role order, every date and metric present in `Knowledge`, and none of the typo strings. A real-profile variant asserts the same generic properties.

---

## 11. Fidelity (NFR-4, D26, POR-69)

### 11.1 Masks and departures

`Board` gains `masks?: readonly { selector: string; reason: string }[]`.

- `check.mts` takes the masked elements' boxes in the **candidate** (`locator.boundingBox()`), counts pixels inside them as equal in both images, and reports the masked share. **A board fails if its masks cover more than 3% of its area**, so a mask cannot quietly excuse a board.
- Masked elements carry `data-fidelity-mask="<name>"`. These attributes do not affect layout and are allowed in production markup.
- `departure` stays for layout changes.

### 11.2 What changes which board

| Change                                                                                                 | Boards                                                               | Treatment                                                                           | Task                    |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| Brand CSS generated, fonts renamed to generic variables, catalog extraction                            | all                                                                  | must stay ≥ 99.9% unmasked (proves A5/A6 are pixel-neutral)                         | 63                      |
| Sidebar title "Staff-level Frontend Engineer" → D17 title                                              | every board with a sidebar (Main, Sidebar, MobileDrawer, all State*) | **mask** `profile-title`                                                            | 55                      |
| "Concurrent" → "Contract" badge                                                                        | ExperienceTimeline, StateTopic, StateRichAnswer                      | **mask** `role-badge`                                                               | 55                      |
| Welcome description loses "Staff-level"                                                                | WelcomeScreen, Main, Mobile                                          | **departure** (D17; reason updated in POR-68 for the evidence line + phone contact) | 55 → 68                 |
| Contact card shows availability (D16)                                                                  | ContactCard, StateContact                                            | **departure** (adds a line)                                                         | 55                      |
| `roleFit` answer reworded (D17), Toptal line (D18)                                                     | StateFollowUp                                                        | **departure**                                                                       | 55                      |
| Portfolio added as a project (D22)                                                                     | ProjectPreview (if the specimen lists all projects)                  | **departure**                                                                       | 55                      |
| Locale switcher at the sidebar foot (first child of the bottom-anchored footer, so nothing else moves) | Main, Sidebar, MobileDrawer, all State*                              | **mask** `locale-switch`                                                            | 66 (when PT is enabled) |
| Evidence line, phone contact + résumé                                                                  | Main, Mobile, WelcomeScreen                                          | **departure** (D12)                                                                 | 68                      |

This list is what D26 in the PRD points to. A board not listed here must stay ≥ 99.9% unmasked.

### 11.3 Fidelity in CI (FR-51, D14)

- **References:** CI cannot capture design references without the design. **Commit the design export** (`design/prototype/`, the canvas `project/` folder with `support.js`), which the owner provides. It is outside the whitelabel scan scope, like `fidelity/reference/`. A forker deletes or replaces it, and the profile README says so.
- **Container:** `mcr.microsoft.com/playwright:v1.64.1-noble@sha256:<digest>`. The tag matches `@playwright/test`, and the digest is pinned (resolved by the implementer with `docker buildx imagetools inspect`). The CI job runs `container: { image, options: --ipc=host }` and uses `actions/setup-node` for Node 24 inside it (the image's Node may differ).
- **CI references:** `fidelity/reference-ci/*.png` are captured **in the same container** by `pnpm fidelity:references --out reference-ci` while serving `design/prototype` on port 4410. They are committed and regenerated only by a workflow-dispatch job (`fidelity-references.yml`) that commits through a PR, never ad hoc. Local `fidelity/reference/` stays for Mac runs. `check.mts` picks the directory by `FIDELITY_REFERENCES` (default local).
- **Job `fidelity`** (in `ci.yml`, on `pull_request`):
  - path filter (`dorny/paths-filter`, pinned by SHA) on `src/ui/**`, `src/app/**`, `src/site/**`, `src/profile/**`, `scripts/fidelity/**` and `design/**`. Skipped jobs count as success in the `ci` summary.
  - Steps: `pnpm install` → `pnpm dev` in the background (the workbench is dev-only) → wait on `/api/health` → `pnpm fidelity` → upload candidate/diff PNGs and the per-board report as an artifact.
- **Report-only fallback:** if the container cannot hold 99.9% on unchanged code (measured over 5 runs), set `FIDELITY_MODE=report` in the job, which exits 0 and still uploads the report. The README records the reason and the measured ratios (D14). Required status is then "ran", not "passed".

---

## 12. Per-task technical design

Ids, dependencies and sets follow the PRD's task table. **Deps** lists both behaviour and file-conflict edges. For every task, **fidelity** means `pnpm fidelity` locally ≥ 99.9% on every gated board, plus the masks and departures listed in §11.2, and nothing else. **IDX** means the task runs `pnpm rag:build`, serially with the other IDX tasks (55 → 56 → 65).

**POR-41 — Offer filter keeps factual sentences (FR-30) · Deps: — · S1**

- Files: `core/assistant/system2/offer-filter.ts`, `offer-filter.test.ts`.
- Design: `isOffer = startsLikeOffer(s) && hasOfferPhrase(s) && !carriesFact(s)`.
  - `hasOfferPhrase` keeps only offer constructions: `(need|want|would like|have) (any )?(more|further|other)? (details|information|questions)`, `feel free`, `let me know`, `happy to help`, `à disposição`, and so on. The bare `ask` / `questions?` alternatives are removed.
  - `carriesFact` is true on a digit, or a third-person subject (`he|his|him|she|her|they|their|ele|ela|dele|dela`, plus `subjectNames`, which POR-54 passes in).
- Tests: the AC-30.1 pair (fails on today's code), plus PT/ES offers still removed, and a sentence split across deltas.

**POR-42 — Router stops refusing valid questions (FR-31) · Deps: — · S1**

- Files: `system1/router.ts` (+test).
- Design: guards require person context.
  - `privateInfo`: `(his|<name>'s|he's) (salary|kids|children|health|age|password|…)`, `(is|was) he (married|…)`, `how much (does|do|did) he (charge|make|earn)`, `(home|street) address`, `phone number`.
  - `offPurpose`: `act as` only when addressed to the assistant (`^(please )?act as`, `\byou\b.{0,20}\bact as`) plus the existing jailbreak phrases.
- Tests: the four AC-31.1 questions (fail today); existing private and injection cases still guarded.

**POR-43 — Forged context never throws (FR-32) · Deps: 42 (router) · S2**

- Files: `app/api/chat/chat-handler.ts` (schema: `topic: z.enum(TOPIC_IDS)`), `system1/router.ts`, `fast-path.ts`.
- Design: lookups go through `isScoredIntent(x)` / `isTopicId(x)` (`Object.hasOwn` over the const arrays). `NEXT_INTENT` and `TOPIC_DEFAULT` become `Readonly<Record<ScoredIntent, ScoredIntent | null>>` / `Record<TopicId, ScoredIntent>`; POR-49 finishes the typed tables. An unknown `lastIntent` is treated as `null`.
- Tests: `lastIntent` ∈ {`constructor`, `__proto__`, `toString`} → normal answer; `topic: 'constructor'` → 400. Each fails today.

**POR-44 — Boundary rules, server-only, cycle (FR-43, FR-44) · Deps: 43 (chat handler) · S3**

- Files:
  - `.dependency-cruiser.cjs` with the §7.1 rules marked POR-44, and **all rules on paths that don't exist yet are added later by the task that creates the path**;
  - `core/assistant/citations.ts` (moved `sourceOf`) and its callers;
  - `chat-handler.ts`: a local `RequestLimiter` interface replaces the `Admission` import;
  - `package.json` (`server-only`), guards in `composition-root.ts` and `env.ts`, the `vitest.config.mts` alias, `src/testing/empty-module.ts`, `--conditions=react-server` on `rag:build` and `eval:assistant`;
  - `src/architecture/{boundaries,client-boundary}.test.ts` with fixtures.
- Risk: dependency-cruiser's `type-only` detection; pinned by a fixture.

**POR-45 — Bounded memory, /64, interrupted tokens (FR-36…38) · Deps: 44, 49 (`model-assistant.ts` after the split) · S4**

- Files: `infrastructure/rate-limit/sliding-window.ts`, `budget/model-budget.ts`, **new `src/http/client-key.ts`** (the first file in `src/http`; `chat-handler` still lives in `app/` and imports it), `system2/model-assistant.ts` (its `streamRound` step from POR-49) and the new `usage.ts`.
- Design: §8.1–§8.3. AC-38.1 accepts the conservative estimate.

**POR-46 — Embeddings resilience, tool exceptions, adapter validation (FR-39, FR-40) · Deps: 44, 45 · S5**

- Files: `ports/embedding.port.ts`, `knowledge-search.port.ts`, `tools/tool.ts`, `registry.ts`, `search-tools.ts`, `system2/model-assistant.ts` (signal to tools), `infrastructure/openai/openai-embeddings.ts`, `resilience/circuit-breaker.ts` (`guard`), `retrieval/vector-knowledge-search.ts`, `github/github-api.ts`, `wikipedia/wikipedia-references.ts`, `composition-root.ts` (second breaker, `report` hooks, health field), `app/api/health/health-handler.ts`.
- Tests: MSW for GitHub and Wikipedia (5xx, bad shape); a fake embeddings port that hangs or throws; a thrown `execute` → tool error and the request completes.

**POR-47 — Evaluation harness (FR-52 part) · Deps: — · S1**

- Files: `scripts/evaluate-assistant.mts`, `scripts/evaluation/cases.ts`.
- Design:
  - `EVAL_RUNS` (default 3); a case passes at ≥ ⌈2N/3⌉ passing runs, and the report shows a per-case pass rate.
  - Calibration: a failing claim prints the tool trace.
  - Every `injection` case gains `avoids`. New categories: `leadership`, `product-vs-person` (EN; the PT cases come in POR-66).
- `cases.ts` moves to `src/profile/evaluation/` in POR-52.

**POR-48 — Coverage thresholds (FR-50) · Deps: — · S1**

- Files: `vitest.config.mts` (`coverage.thresholds` per glob for `src/core/**` and `src/infrastructure/**`, value = measured − 2, floored), `ci.yml` (matrix gate `test` → `test:coverage`), README section.
- Rule recorded in the README: lowering a threshold needs a stated reason in the PR. POR-52, POR-53 and POR-54 move code and may re-baseline once, with the measurement in the PR.

**POR-49 — Core code health (FR-47 core) · Deps: 41, 42, 43 · S3**

- Files: `system2/model-assistant.ts`, `composition-root.ts` (temperature comment), `system1/router.ts`.
- Design:
  - `answer()` splits into `startMessages`, `streamRound`, `runActions`, `collectEffects`, `closeAnswer`, each one level of abstraction, with the same events.
  - The temperature comment states that 0 is chosen for determinism.
  - Tables are typed by unions.
  - `COMPANY_PROFILE` is derived from the single `COMPANIES` list (derived from knowledge in POR-54).
- Safety net: a fast-path golden snapshot (every topic question's response text) is added here and deleted in POR-54 once the answers have moved and matched it.

**POR-50 — Link allow-list (FR-34) · Deps: 46 · S6**

- Files: `system2/link-filter.ts` (+test), `model-assistant.ts` (the chain, and the allowed set from tool results), `composition-root.ts` (`knownUrls` from knowledge).
- Design: §8.8. Tests: AC-34.1, links split across deltas, a nested bracket, an unterminated `[`.

**POR-51 — Model answer quality (FR-35) · Deps: 46, 47, 50 · S7**

- Files: `tools/knowledge-tools.ts` (`getExperience` gains `aspect: 'all' | 'leadership' | 'impact'`), `system-prompt.ts` (the leadership rule), new `system2/sources.ts#usedSources(text, evidence)` (keep a source only if the answer names its company/product or shares at least 2 distinctive word trigrams with its evidence), `model-assistant.ts`.
- Measured with POR-47: AC-35.1 at ≥ 2/3.
- **As built (deviation):** leadership retrieval is a re-rank inside `searchKnowledge` (`tools/search-tools.ts`), not a `getExperience` `aspect`, so POR-51 stays out of `knowledge-tools.ts`, which POR-52 rewrites. For a question about leading people (leader/líder/mentor/supervise/gestor, or manage/lead/gerenciar/gestão/coordenar with a people word nearby) it adds at most 3 passages from an experience-only search in front, displacing only the weakest résumé passages, never notes. The prompt sends leadership questions to that search and forbids answering with skill names. Tool results may attribute text per source (`ToolResult.evidence`). In `usedSources`, a name counts only when it does not open a sentence and exactly one of the answer's sources carries it. Cards always cite what they show, and when nothing matches, every retrieved source is kept. T51.3 is replaced by the `search-tools.test.ts` leadership cases.

**POR-52 — Profile folder and knowledge injection (FR-1 part, FR-2 part, FR-5) · Deps: 44, 46, 47, 49 · S6**

- Files:
  - `src/profile/**`: EN-only `Localized` authoring, `index.ts`, `schema.ts`, the validation, the README guide, `locales.ts` = `['en']`;
  - `core/knowledge/{schema,localize,validate,corpus}.ts`, with `ids.ts` and `data/` deleted;
  - the core factories take `Knowledge` (`createKnowledgeTools(k)`, `createResponseKit(k)`, `createFastPath`); answer prose stays in core until POR-54;
  - `composition-root.ts` binds the profile; the index moves to `profile/generated/`; eval cases move to `profile/evaluation/`;
  - `scripts/build-knowledge-index.mts` and `evaluate-assistant.mts` read from the profile;
  - the `profile-*` boundary rules (§7.1);
  - the whitelabel test, scoped to the moved data.
- The corpus text must be **byte-identical**, verified by the index hash test, so no IDX is needed.
- `src/app` helpers keep importing what they need, now from `core/knowledge/localize` plus a temporary **profile import inside `src/app/workspace-props.ts` / `structured-data.ts` / `layout.tsx`**. The `only-roots-read-the-profile` rule allows `src/app` until POR-53 removes the exemption, when those helpers move behind `site-root.ts`.
- Fidelity: unchanged.

**POR-53 — Helpers out of `src/app` (FR-42, FR-3 data side) · Deps: 52, 45 (chat handler) · S7**

- Files: `src/http/{chat-handler,event-stream,health-handler}.ts` (moved next to `client-key.ts`), `src/site/*` (metadata, structured data, routes, workspace view, images, sitemap/robots builders, workbench fixtures, `create-site.tsx`), `src/site-root.ts` (server-only), thin `src/app` files, `profile/fonts.ts` and `profile/brand.ts` (the old equality test now points at `brand.ts` until POR-63 generates the CSS), the boundary rules for `site`, `http` and the `core`/`profile` clauses of `app-goes-through-roots`.
- Still one locale and no `[locale]` segment (that is POR-64), so routes are unchanged.
- Fidelity: unchanged.
- As built (deviation):
  - Font face variables are `--font-face-text`, `--font-face-display` and `--font-face-code`. The planned `--font-display` would collide with the Tailwind `--font-display` token, which would then reference itself. §2.3 and §4.4 are corrected; POR-63 generates `brand.css` with these names.
  - `globals.css` moved to `src/ui/globals.css` here rather than in POR-63, because AC-42.1 allows only route and special files in `src/app`. `prettier.config.mjs` and `ui/cn.test.ts` point at the new path.
  - `app/global-error.tsx` (a client component, so it cannot use the server-only `site-root`) imports `profile/fonts` directly. A rule, `global-error-reads-only-fonts`, allows exactly that file; `client-boundary.test.ts` exempts `profile/fonts.ts` from the server-only set.
  - `profile` reading is reported only by `only-roots-read-the-profile`; `site-is-profile-agnostic` and `http-is-injected` omit it so one edge raises one violation.
  - No `site/workbench`: POR-75 (#68) deleted the workbench and the fidelity tooling, so nothing was moved there, and `ui/rich/examples.ts` stays put.
  - The root title and description are built from the profile name (same text); the rest of that copy moves to the profile in POR-63. The types file is `site/site-profile.ts` (`Brand`, `SiteProfile`).
  - Turbopack splits CSS by folder, so the font CSS and the stylesheet now ship as two files instead of one; the rules and their order are unchanged.

**POR-54 — Fast path derives facts; prose, owner intents and vocabulary to the profile (FR-4, FR-54 core) · Deps: 52, 51 · S8**

- Files: `core/assistant/{answer-kit,topics,topic-pages}.ts`, `system1/{router,rules.en,fast-path,technologies}.ts`, `system1/responses/*` deleted → `profile/copy/en/answers.ts`, `tools/reference-catalog.ts` → knowledge `references`, `src/testing/fixture-profile/` (EN, and PT added in POR-65), every core test migrated to the fixture.
- Design: §5.4. Intent renames (`hrisRole → leadRole`, `staffFit → roleFit`, `quality → qualityImprovement`); company and project patterns derived from knowledge; `subjectNames` passed to the offer filter.
- Tests:
  - AC-4.1: the real copy plus knowledge with a role's `end` changed → the answer shows the new date;
  - AC-4.2: the whitelabel scan widened to `src/core`;
  - AC-54.1 (core part);
  - the POR-49 golden snapshot must match before it is deleted, which proves the EN answers are byte-identical.
- Fidelity: unchanged.
- **As built:** the profile supplies `copy.en.answers: AnswerSet` (`core/assistant/answer-set.ts`) as `{ vocabulary, topics(kit), answers(kit) }` rather than per-builder `(kit, ctx, question)` functions; the answers live in `profile/copy/en/answers/` (one file per area plus `facts.ts`, which names companies, periods, metric values and team sizes from the record). `createFastPath(knowledge, answers)`, `createTopicCatalog(topicCopy)` and `createTopicIntro(catalog)`; topic pages are part of the topic copy. The router derives the owner's name (accent-tolerant), companies and `aliases` from the record. Company encyclopedia titles are `role.reference`, technology titles `knowledge.references.technologies`, and the notes' evidence-tag guide `knowledge.notes.guide` (the system prompt takes a `PromptSubject`). Labels inside answers (role sections, the contact card) stay generic English in core until POR-66. The golden snapshot matched unchanged before it was deleted; the model-facing changes are `searchKnowledge`'s description ("his documented record") and two payload keys of the external tools, renamed so they no longer carry the owner's name: `getTechnologyBrief`'s `marcio` → `inHisRecord` and `getCompanyBrief`'s `marcioRole` → `hisRole`. The "Golden Award" is read from the role's achievements (`facts.award`), and `references.technologies` must list at least one technology. The router's generic rules still assume he/his (pronouns arrive with the identity in POR-66), so the fixture's questions avoid "what is her …". POR-76's page-aware fast path (no Achievements topic; parts a topic page already shows are left out; follow-ups must lead to a different answer) is carried over: the fast path builds the topic catalog from the same `AnswerSet`, so judging a follow-up can no longer fail on another profile, and POR-76's `try/catch` around it is gone.

**POR-55 — Record corrections (FR-17…FR-21) · Deps: 54, 53, 58 · S9 · IDX**

- Files:
  - `profile/knowledge/*`: D17 headline/title; D16 availability; the D18 Toptal line drawn from an existing highlight; D19 `engagement: 'contract'` for Roots/Maison/Freelance; D21 FictionDraft `status: 'concept'`; the D22 portfolio project; `start/end` → `YearMonth`; the review's typos fixed in the source;
  - `profile/copy/en/{answers,site}.ts`;
  - `core/chat/components.ts` (from POR-58): `RoleView.badges`, `ProjectView.labels`;
  - `core/i18n/format.ts` (period);
  - `ui/rich/{timeline-role,contact-card,projects}.tsx`.
- `data-fidelity-mask` attributes; board masks and departures per §11.2; `check.mts` gains mask support (§11.1), which POR-69 reuses in CI.
- AC-17.2: the `roleFit` answer argues scope from facts, and the suggestion "What makes Marcio a strong Staff Engineer?" becomes "What scope has he worked at?".
- **As built:**
  - Roles carry `engagement: 'employment' | 'contract'`; the view is a `RoleView.contract` boolean, not `badges`/`labels`, and the timeline shows "Contract" for Roots, Maison Moderne and Freelance. `isConcurrent` is deleted. `engagement` is kept out of the model's `getExperience` payload, since "employment" is not stated in the record; the role passage in the corpus says "(contract)".
  - `ProfileSource.availability` (D16) feeds the contact card, the contact and location answers, `getProfileSummary` and the profile passage. The city stays: the owner documented João Pessoa himself in POR-40, after D16.
  - The page title, description, OG/Twitter text, share image, JSON-LD and sidebar subtitle read the D17 headline from `profile.title`. Projects gain `outcomes`; the portfolio is the project `marciomariani-dev` (stack from `package.json`, outcomes the CI proves); FictionDraft's status is "Concept". "Staff-level" positioning is reworded out of the owner's notes (`knowledge-base.md` §1, §1.2, §8.7, FAQ "Ele é Staff Engineer?" and "Ele é a pessoa certa para minha vaga?") as title-plus-scope evidence.
  - Root-relative site paths (one leading `/`, never `//` or `/\`) are links in the shared grammar (`isSitePath`), for both the renderer and the link filter, so the fast path's résumé link renders.
  - Deferred: `start/end` → `YearMonth` and locale date formatting (`core/i18n/format.ts`) move to POR-64 with FR-16; the owner-written period labels stay. Dropped: masks, departures and `check.mts` mask support, since the owner removed the fidelity tooling.

**POR-56 — Product-site ingestion (FR-25…27, AC-26.x) · Deps: 55, 51 · S10 · IDX**

- Files: `scripts/ingest-sites.mts` + `scripts/ingest/{robots,extract,chunk}.ts` (tests on fixture HTML and robots files), `profile/sites/{allow-list.ts,snapshot.json}`, `core/knowledge/corpus.ts`, `tools/search-tools.ts` (`about`), `system-prompt.ts`, `profile/evaluation/cases.ts` (EN cases), `ui/rich/projects.tsx` (no empty technologies row), `package.json` (`sites:ingest`; dev dependencies `robots-parser`, `@mozilla/readability`).
- Design: §9.

**POR-57 — Retry/edit cancels the in-flight answer (FR-33) · Deps: — · S1**

- Files: `ui/chat/conversation-store.tsx` (`inFlight: Map<key, { controller, answerId }>`), `ui/chat/use-chat.ts`, `ui/chat/chat-workspace.tsx` (`reveal.finish()` on cancel, §0.1-4).
- Design: `cancel()` aborts **and** applies `stopAnswer(current, answerId)`; `retry`, `edit`, `startOver` and `stop` all go through it. POR-35's `retry` guard (`store.busy && !activeAnswer`) stays.
- Test (RTL + MSW streaming): AC-33.1 for retry and for edit. It fails today: the old answer stays `streaming`.

**POR-58 — Single client/server contracts (FR-46) · Deps: 57, 43, 53 · S8**

- Files: new `core/chat/*` (§7.4); `core/assistant/assistant-event.ts` and `components.ts` deleted; imports updated everywhere; `ui/chat/chat-client.ts` (event types and `INTERRUPTED` from core; error text stays as English constants keyed by code until POR-63); `http/chat-handler.ts` (schema import); the `chat-contract-is-below-engine` rule.
- Test AC-46.1: change `MAX_QUESTION_LENGTH` in a test and assert both the composer `maxLength` and the schema follow.

**POR-59 — Knowledge base out of the client bundle (FR-45, NFR-1) · Deps: 58, 54 · S9**

- First step: the baseline. `e2e/bundle.spec.ts` sums the gzipped same-origin scripts for `/` → `e2e/budgets/client-js.json` `{ baseline }`.
- Files:
  - `site/workspace-view.ts` builds the `seed` conversation, the topic nav, the suggestion pools, the assistant identity and the max length;
  - `core/conversation/conversation.ts` drops `topics`/`topic-pages`/`response-kit` (`createConversation(topic, intro?)`);
  - `ui/chat/{chat-workspace,assistant-message,use-chat,thinking-status}.tsx` take props (the owner name in the thinking phrases now comes from the identity prop);
  - `AssistantEvent.start.related` becomes `{ id, company } | null`;
  - `ui/rich/examples.ts` moves out;
  - the `ui-reads-contracts-only` rule is enabled.
- Assertions: AC-45.1; first-load JS ≤ 0.9 × baseline, stored as `{ baseline, ceiling }`. Later tasks assert `≤ ceiling + 5 KB`.
- Fidelity: unchanged.
- **As built (deviation):**
  - The baseline is taken at `821abaf`, the last commit that still shipped the record to the browser: 180,908 B gzipped on `/`. POR-52…58 had already moved the record behind server-built props, so at the start of POR-59 only type-only imports remained, and those emit no JS.
  - NFR-1's 10% cut was not reached: first-load JS on `/` and `/experience` is 167,042 B, −7.7% across POR-52…59. The orchestrator accepted this. The remaining ~149 KB is React, the Next router and tailwind-merge; the app's own client code is ~14 KB of interactive and streaming UI, so cutting further would mean a UI redesign (server-rendered slots for the sidebar and welcome screen), not a bundle fix.
  - `e2e/budgets/client-js.json` therefore stores `ceiling` as the measured POR-59 value (167,042 B) with `growthAllowance` 5,120 B. From POR-59 on, `e2e/bundle.spec.ts` asserts the home page stays `≤ ceiling + growthAllowance`.

**POR-60 — Heartbeat, deadline, `maxDuration`, parser (FR-41, FR-48, AC-41.2) · Deps: 58 · S9**

- Files: `http/event-stream.ts`, `http/chat-handler.ts`, `env.ts` (`CHAT_REQUEST_TIMEOUT_MS`), `app/api/chat/route.ts` (`maxDuration = 75`), `core/assistant/assistant.ts` (visitor vs deadline), `ui/chat/sse-parser.ts`, `chat-client.ts`.
- Design: §8.6, §8.7. AC-41.2 is verified on a preview deploy.

**POR-61 — UI code health (FR-47 UI) · Deps: 59 · S10**

- Files:
  - `ui/chat/conversation-list.tsx` (message mapping extracted from `ChatWorkspace`, including the `reveal.view()` and `busy || chat.waiting` wiring POR-35 added);
  - `ui/chat/use-copy-confirmation.ts` (one timer, two users);
  - `conversation-store.tsx`: the context value memoized on `[conversations, inFlight]`, with `busy` derived inside the memo.
- Behaviour-preserving. Fidelity unchanged.

**POR-62 — Motion e2e waits on conditions (FR-49) · Deps: — · S1**

- Files: `e2e/motion.spec.ts`, which already covers POR-35's thinking shimmer and typing reveal.
- Design: `expect.poll` and web-first assertions on observable states: the shimmer present → the typed text length grows over successive polls → `aria-busy=false`. No `waitForTimeout`.
- Proof: `--repeat-each=20`, 20/20 (AC-49.1), with the output in the PR.

**POR-63 — Interface catalog, brand tokens, full whitelabel (FR-1…FR-3, FR-54, FR-55, AC-1.x, AC-54.x, AC-55.1) · Deps: 61, 60, 55 · S11**

- Files:
  - `ui/i18n/*` and `profile/copy/en/ui.ts`. Every hard-coded UI string moves to the catalog: the POR-35 strings (thinking phrases with `{firstName}`, the waiting helper), error text by code, and the rate-limit plural;
  - `scripts/generate-brand-css.mts` + `profile/generated/brand.css` + the drift test, with `app/brand-colors*` deleted;
  - `src/app/globals.css` → `src/ui/globals.css` (shimmer and the other motion tokens stay there, §0.1-5), with the brand import; generic font variables;
  - every UI, http and site test moves to the fixture; e2e reads from `profile`;
  - `profile/design/scenarios.ts`; the `check.mts` live URL from `identity.siteOrigin`;
  - the whitelabel scope becomes all of §4.5; the AC-1.2 test (§4.7).
- **Fidelity: every board ≥ 99.9% with no new mask or departure.** That proves the catalog and generated tokens are pixel-neutral.

**POR-64 — Locale routing and per-locale surfaces, English only (FR-6…9, FR-15, FR-16, FR-57, AC-6.3, AC-56.1) · Deps: 63 · S12**

- Opens with the §3.6 spike.
- Files: `app/[locale]/**`, `next.config.ts` (redirects and rewrites, with `getRewrittenUrl`/`getRedirectUrl` tests), `site/{routes,metadata,structured-data,sitemap,create-site}.ts`, the share-image and icon routes, `ui/shell/locale-switch.tsx`, the `sidebar.tsx` foot and the drawer, `conversation-store` keys `${locale}:${topic}`, the **`ChatWorkspace` key** (§0.1-1), `I18nProvider` in the layout, `chat-client` sending `locale`.
- Switcher and metadata as designed in §3 and §5. The switcher renders only when `profile.locales.length > 1`, so it doesn't appear yet.
- Tests: site builders with the fixture (both locales enabled) for AC-15.x and AC-16.1; routing unit tests; e2e on the real profile: EN unchanged, `/pt/*` 404 (AC-56.1), `/en/skills` 308 (AC-6.3).
- Fidelity: unchanged.

**POR-65 — Portuguese content and integrity (FR-13, FR-14, NFR-8, AC-56.1) · Deps: 64, 56 · S13 · IDX**

- Files: every `Localized` gains `'pt-BR'`; `profile/copy/pt-BR/{ui,site,answers,resume}.ts`; the PT fixture copy; the bilingual corpus; `catalogs.test.ts`. `profile.locales` stays `['en']`. The integrity test validates with the candidate set `['en','pt-BR']`.
- NFR-9: every PT number, date and metric token must also appear in its EN counterpart.

**POR-66 — Bilingual fast path, model locale, PT enabled (FR-10…12, FR-52 PT, FR-56) · Deps: 65, 51 · S14**

- Files: `core/assistant/language.ts`, `system1/rules.pt-BR.ts`, `fast-path.ts` (answer locale), `system2/system-prompt.ts` (page-locale tie-break), the cache key, `profile/evaluation/cases.ts` (PT), **`profile/locales.ts` = `['en','pt-BR']`**, `e2e/i18n.spec.ts`, axe in both locales, `lighthouserc.json` with `/pt`, board masks `locale-switch`.
- Tests: the per-locale suggestion graph (AC-12.1); the detection constraint on every suggested question; AC-10.1–10.3.

**POR-67 — Generated résumé (FR-28, FR-29) · Deps: 65, 55 · S14**

- §10. Generates a PDF for each **enabled** locale, so `/pt/marcio-alves-curriculo.pdf` appears once POR-66 has enabled PT (whichever of the two merges second); the test renders both locales from the fixture regardless. `public/marcio-alves-resume.pdf` is deleted from git; `.gitignore` gains the generated paths.

**POR-68 — Phone welcome contact and evidence line (FR-22, FR-23) · Deps: 63, 55, 67 · S15**

- Files: `ui/welcome/welcome-screen.tsx` (evidence line under the heading; contact and résumé at `@max-phone/ma`), `site/workspace-view.ts` (`evidenceLine`), copy in both locales. POR-35's `welcome-layout` and `suggested-questions` (`disabled`) are untouched.
- Departures for Main, Mobile and WelcomeScreen, with the reason updated from POR-55's.
- Test AC-23.1 (fixture metric change; visibility at 390/760/1440 above the fold).

**POR-69 — Fidelity in CI (FR-51, AC-51.1, AC-51.2) · Deps: 66, 68 · S16**

- §11.3. The orchestrator commits the design export under `design/prototype/`.
- Files: `.github/workflows/ci.yml` (job, paths filter, summary needs), `.github/workflows/fidelity-references.yml`, `scripts/fidelity/{check,capture-references}.mts` (`--out`, env-selected references; masks exist since POR-55), `fidelity/reference-ci/*.png`, README section.

**POR-70 — README, CONTRIBUTING, repository settings (FR-53, FR-24) · Deps: 41–69 · S17**

- The orchestrator runs `gh repo edit` and pastes `gh repo view --json homepageUrl,repositoryTopics` in the PR.
- `scripts/check-readme.mts` (in the `verify` matrix) asserts every `pnpm <script>` named in the README exists and every stated threshold matches the config (AC-53.2).

---

## 13. Testing hooks this design creates (for the test strategist)

| Layer                 | New suites                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture (node)   | `architecture/boundaries.test.ts`, `architecture/client-boundary.test.ts`, `architecture/whitelabel.test.ts`                                                                 |
| Profile               | `profile.test.ts`, `catalogs.test.ts`, `generated/brand-css.test.ts`, index hash (moved), snapshot validation                                                                |
| Core                  | the fixture-profile migration of every existing suite; `language.test.ts`; per-locale suggestion graph; `link-filter`, `offer-filter`, `usage`, `format`                     |
| HTTP / infrastructure | `client-key`, `event-stream` (heartbeat/deadline), limiter sweep/cap, embeddings guard, adapter validation (MSW)                                                             |
| Site                  | `create-site.test.tsx` (AC-1.2), metadata/hreflang/sitemap/JSON-LD for both locales, `next.config` rewrite and redirect tests                                                |
| UI                    | `sse-parser`, `use-chat` cancellation, switcher a11y, localized states                                                                                                       |
| E2E                   | `i18n.spec.ts`, `bundle.spec.ts` (budget + knowledge-leak + phone), updated `seo`, `a11y` (both locales), `mobile` (drawer switcher, welcome contact), `motion` (conditions) |
| Scripts               | `ingest/*` (robots, extract, chunk on fixtures), `resume.test.ts` (pdfjs text)                                                                                               |

---

## 14. Risks and rollback

| #   | Risk                                                                                                                        | I×P | Mitigation                                                                                                                                        | Rollback                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| R1  | `afterFiles` rewrites misbehave with `partialPrefetching` and the segment cache (an `/en/` URL leaks, or a prefetch misses) | 5×2 | §3.6 spike before any move; the no-`/en/`-request e2e assertion; plan B `proxy.ts`                                                                | Revert POR-64 (one PR). EN routes return to `app/`                          |
| R2  | Next changes root-layout state keying (a param change remounts) and breaks AC-9.2                                           | 4×1 | Pinned Next version; AC-9.2 e2e guards upgrades                                                                                                   | `sessionStorage` persistence (keeps AC-9.1; AC-9.2 needs an owner decision) |
| R3  | Catch-all `[...rest]` under `cacheComponents` doesn't 404 at build                                                          | 3×2 | Spike step                                                                                                                                        | `globalNotFound` with a bilingual page                                      |
| R4  | POR-52/53/54 mechanical refactors change behaviour silently                                                                 | 4×3 | Byte-identical corpus hash; fast-path golden snapshot; fidelity; e2e                                                                              | Revert the PR; nothing persistent changes                                   |
| R5  | Brand CSS / `color-mix` shifts pixels                                                                                       | 3×2 | POR-63's gate demands ≥ 99.9% with no new mask                                                                                                    | Keep literal `rgb()` shadows, generated from brand values                   |
| R6  | `@react-pdf/renderer` peer or React 19 issue                                                                                | 3×2 | Install-time check; isolated script                                                                                                               | `pdfkit` imperative fallback (same output contract)                         |
| R7  | Product sites are client-rendered and readability extracts nothing                                                          | 3×3 | `render: 'browser'` mode; loud failure                                                                                                            | Exclude that site from the allow-list (record why)                          |
| R8  | The CI container cannot hold 99.9%                                                                                          | 3×3 | Same-container references                                                                                                                         | `FIDELITY_MODE=report` (D14)                                                |
| R9  | The design export is not committed                                                                                          | 4×3 | the orchestrator commits it in POR-69                                                                                                             | POR-69 ships report-only against the Mac references                         |
| R10 | Bilingual index size (~2.5× today, about 750 KB JSON) inflates the function cold start                                      | 2×3 | Server-only import; measured in POR-65                                                                                                            | Float32 base64 encoding of vectors (a one-file change in `index-spec`)      |
| R11 | Language detection misroutes short PT questions                                                                             | 3×3 | Authoring test over every suggestion; ambiguous → page locale                                                                                     | Tune the marker sets (copy-free change)                                     |
| R12 | Test migration to the fixture profile weakens assertions                                                                    | 4×2 | The fixture exercises every intent; real-profile generic tests remain; reviewers check that no assertion became tautological (`meaningful-tests`) | —                                                                           |
| R13 | `maxDuration` or the deadline differs on Vercel                                                                             | 3×2 | Verified on a preview deploy in POR-60                                                                                                            | Lower `CHAT_REQUEST_TIMEOUT_MS` by env (no code)                            |

Rollback in general: every task is one revertable PR. No data migration exists. The generated artifacts (index, snapshot, brand CSS) are committed, so reverting a PR restores them. Enabling Portuguese is a one-line `profile/locales.ts` change, so turning PT off is instant and keeps all the code.

---

## 15. PRD review status

The revised PRD adopted the earlier recommendations:

- the POR-41…POR-70 ids;
- the POR-35 gate dropped;
- the POR-52/53 split;
- FR-54/FR-55 (fixture profile, e2e reading from the profile);
- D26 masks ≤ 3% plus departures;
- D30/FR-56 (Portuguese gated until POR-66);
- FR-57/AC-6.3 (`/en` → 308);
- AC-38.1 (conservative estimate);
- AC-41.2 (`maxDuration`);
- AC-28.1 (fixed résumé URLs);
- the design export committed in POR-69.

Open points this design settles without needing a PRD change:

1. **AC-16.1 `mar. 2026`.** The default `pt-BR` output is `mar. de 2026`; §5.6 formats the parts explicitly.
2. **AC-25.2 (build with no network).** It is satisfied structurally: the snapshot and index are static imports, and `src-never-imports-scripts` holds. An optional CI build in a `--network=none` container can be added in POR-69 if the owner wants an executable proof.
3. **FR-45 "rendered on the server".** Implemented as "built on the server and passed as data" (§12, POR-59). AC-45.1 tests the bundle, which is the observable requirement.
4. **NFR-1 measurement.** The first-load JS is the gzipped sum of same-origin scripts on `/` (`e2e/bundle.spec.ts`). The baseline is taken at the start of POR-59.
5. **Résumé for PT before Portuguese is enabled.** POR-67 generates only enabled locales (D30), so the PT PDF goes live with POR-66, whichever of the two merges second.

---

## 16. Traceability

| Requirement           | Design §                            | Task                                |
| --------------------- | ----------------------------------- | ----------------------------------- |
| FR-1, FR-5            | 4.1, 4.2                            | 52, 63                              |
| FR-2, AC-1.1, AC-4.2  | 4.5                                 | 52 → 54 → 63                        |
| FR-3, AC-3.1          | 4.4                                 | 53 (data), 63 (tokens)              |
| FR-4, AC-4.1          | 5.4                                 | 54                                  |
| FR-6, FR-7, D2, D3    | 3                                   | 64, 66                              |
| FR-8, NFR-2           | 3, 12 (POR-64)                      | 64, 66                              |
| FR-9, D5              | 0.1-1, 3.1                          | 64                                  |
| FR-10…FR-12           | 5.4, 5.5                            | 66                                  |
| FR-13, FR-14, NFR-8   | 5.1, 6.1–6.3                        | 65                                  |
| FR-15, NFR-3          | 3.5, 12 (POR-64)                    | 64, 66                              |
| FR-16                 | 5.6                                 | 55, 64                              |
| FR-17…FR-21           | 11.2, 12 (POR-55)                   | 55                                  |
| FR-22, FR-23          | 12 (POR-68)                         | 68                                  |
| FR-24, FR-53          | 12 (POR-70)                         | 70                                  |
| FR-25…FR-27           | 9                                   | 56                                  |
| FR-28, FR-29, NG11    | 10                                  | 67                                  |
| FR-30                 | 12 (POR-41)                         | 41                                  |
| FR-31                 | 12 (POR-42)                         | 42                                  |
| FR-32                 | 7.4, 12 (POR-43)                    | 43                                  |
| FR-33                 | 0.1-4, 12 (POR-57)                  | 57                                  |
| FR-34                 | 8.8                                 | 50                                  |
| FR-35                 | 12 (POR-51)                         | 51                                  |
| FR-36…FR-38           | 8.1–8.3                             | 45                                  |
| FR-39, FR-40, NFR-6   | 8.4, 8.5                            | 46                                  |
| FR-41, FR-48, AC-41.2 | 8.6, 8.7                            | 60                                  |
| FR-42                 | 2.2, 2.3                            | 53                                  |
| FR-43, FR-44, NFR-7   | 7.1–7.3                             | 44, 52, 53, 58, 59                  |
| FR-45, NFR-1          | 7.3, 12 (POR-59)                    | 59                                  |
| FR-46                 | 7.4                                 | 58                                  |
| FR-47                 | 12 (POR-43, POR-49, POR-54, POR-61) | 49, 61                              |
| FR-49                 | 0.1-5, 12 (POR-62)                  | 62                                  |
| FR-50                 | 12 (POR-48)                         | 48                                  |
| FR-51, NFR-4, D26     | 11                                  | 55, 63, 66, 68, 69                  |
| FR-52                 | 12 (POR-47, POR-56, POR-66)         | 47, 56, 66                          |
| FR-54, FR-55          | 4.6                                 | 54 (core), 63 (http, site, ui, e2e) |
| FR-56, D30            | 3.3                                 | 64, 65, 66                          |
| FR-57, AC-6.3         | 3.2                                 | 64                                  |
| NFR-5                 | 3.5, 4.4, 9                         | 56, 63, 64                          |
| NFR-9                 | 12 (POR-65)                         | 65                                  |
