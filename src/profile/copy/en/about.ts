import { MAX_HISTORY_MESSAGES } from '@/core/chat/request';
import {
  MAX_CALLS_PER_ROUND,
  MAX_OUTPUT_TOKENS,
  MAX_ROUNDS,
} from '@/core/assistant/system2/model-assistant';
import type { AboutPageCopy } from '@/site/about-page';

export const REPOSITORY = 'https://github.com/marcio-w-alves/marcio-alves-portfolio';

/** The one page without a chat: how this site itself is built, in his words. */
export const about: AboutPageCopy = {
  label: 'About this site',
  title: 'How this portfolio is built',
  description:
    'How this portfolio is built: Next.js, TypeScript and Tailwind, a grounded AI assistant, the ways it saves tokens, and how Marcio builds with AI.',
  markdown: `This site is a portfolio you can talk to. Instead of a static page about Marcio, an assistant answers questions about his career — and it may only say what his record documents. This page explains how it is put together. Its code is public on [GitHub](${REPOSITORY}).

## The stack

- **Next.js 16** with the App Router and **React 19**: pages are Server Components, prerendered at build, and only the chat is interactive in the browser.
- **TypeScript** in strict mode across the whole codebase, with **Zod** validating everything that comes from outside — requests, the model's tool calls, adapters' responses.
- **Tailwind CSS 4**, styled only through design tokens: no hand-written CSS for anything a utility can express.
- **OpenAI**: \`gpt-4o-mini\` writes the answers that need a model, and \`text-embedding-3-small\` powers the search over his record.
- **Vercel** hosts it, with a preview deployment for every pull request.
- **Quality tooling**: Vitest, Testing Library and MSW for unit and integration tests; Playwright and axe for end-to-end and accessibility; Lighthouse CI for performance budgets; dependency-cruiser for architecture rules; ESLint, Prettier, lefthook and commitlint on every commit.

## The architecture

The code follows Clean Architecture. The domain and its policies live in a core that is plain TypeScript: it never imports Next.js, React or the OpenAI SDK, and a test fails if it ever does. Everything that talks to the outside world — the model, the search index, Wikipedia, GitHub — sits behind a port in an adapter, wired together in one composition root.

The site is also white-label. Everything about Marcio — his record, his wording, his colours and fonts — lives in one profile folder, and another test fails if the core so much as names one of his companies. Swap the profile and the same code renders someone else's portfolio.

## How the assistant answers

Every question takes one of two paths, and the visitor cannot tell which.

1. **System 1, a deterministic router.** Questions it recognizes with certainty — every question the interface suggests, the refusals, technologies weighed against his record — are answered straight from the knowledge base. No model call, no tokens, no waiting.
2. **System 2, the model.** Everything else goes to \`gpt-4o-mini\`, which may only act through an allow-list of named, validated actions: look up a role, search his record, describe a technology, show a card. It is never handed the knowledge base itself.

The search is retrieval-augmented generation: every statement of his résumé and every section of his knowledge-base notes is embedded once, offline, into an index committed with the code. At run time only the question is embedded, and passages under a relevance floor are dropped, so an off-topic question finds nothing rather than the least irrelevant facts.

## How it stays honest

- **Grounding.** A fact about Marcio may only come from an action's result in the conversation. When nothing documents an answer, the assistant says so and names what it can cover instead — it never fills the gap with a plausible guess.
- **Evidence levels.** His notes mark each statement as résumé fact, his own account, or a study for one of his products. The assistant follows those marks: a design for a side project never becomes production experience at an employer.
- **Safety.** Whatever an action returns is data, never instructions; requests to change the rules, reveal them or play another role are declined.
- **Evaluation.** A suite of conversations — career facts, technologies, undocumented details, off-topic requests, injection attempts, other languages — runs against the real wiring. A second model must back every claim in an answer with a passage it copies from the evidence, and the script checks the passage is really there.

## Spending fewer tokens

The model is the only part that costs money, so it is used as little as an honest answer allows.

- **Free answers first.** System 1 answers everything the interface suggests without a model call, and topic pages are rendered from the record at build time.
- **A small model.** \`gpt-4o-mini\` is enough for answers grounded in retrieved facts, at a fraction of a larger model's price.
- **A bounded loop.** At most ${String(MAX_ROUNDS)} rounds per answer, the last one forced to write instead of calling another action; at most ${String(MAX_CALLS_PER_ROUND)} actions per round, run concurrently; ${String(MAX_OUTPUT_TOKENS)} output tokens per round.
- **Short context.** Only the last ${String(MAX_HISTORY_MESSAGES)} messages of a conversation are sent, each cut to a short length; searches return a handful of passages, with long notes capped so they never crowd out the résumé; on a topic page the model gets a compact summary of what the page already shows, so it does not spend tokens repeating it.
- **Embeddings once.** The search index is built offline, so a build needs no key and a visit embeds only the question.
- **Caching.** A question asked without history is answered by the model once per page, then replayed from cache at no cost.
- **Budgets.** By default each visitor may start 15 model answers in any ten minutes, and each server stops calling the model after about two million tokens a day; a visitor past a limit still gets a free answer pointing to what works. The hard ceiling is the monthly budget on the OpenAI project.

## How Marcio builds with AI

This portfolio was built with Claude Code, and the way it was built is part of what it shows.

- **Plans before code.** Each piece of work starts as a requirements document, a technical design and a test plan, rendered as a reviewable page. Nothing is implemented until he approves it.
- **Small, verifiable tasks.** An approved plan is split into tickets. Agents implement them in parallel, each in its own git worktree, and every ticket ends as one pull request.
- **Checks before people.** Typecheck, lint, architecture rules, unit, integration, end-to-end, accessibility and performance tests all run before review. A bug fix ships with a test that fails without it, and no test is bent to pass.
- **People decide.** The agents implement and verify; the architecture, the trade-offs and the final acceptance stay with him.

## The quality bar

- **Lighthouse:** 100 for accessibility, best practices and SEO on every page, on phones and on desktops.
- **Accessibility:** WCAG 2.1 AA checked by axe on every page and state, plus keyboard navigation, a skip link, headings in order and controls sized for fingers on phones.
- **Search and sharing:** a canonical address, a share card and structured data on every page — a schema.org ProfilePage about him, and breadcrumbs.
- **Security:** a Content Security Policy that allows only this origin, HSTS and the other security headers, request bodies capped and validated, per-client rate limits, and the model's key only ever on the server.`,
};
