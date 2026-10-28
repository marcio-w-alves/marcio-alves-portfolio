import type { ProjectId, RoleId } from '../ids';

// How Marcio works, as his knowledge-base notes describe it, condensed into
// English for the pages and the fast path. Each statement keeps the notes'
// evidence level in its own wording: résumé facts are stated plainly, his own
// account is "he describes", and work on his own products is never presented
// as production work at an employer.

/** How he takes a system problem from question to delivery. */
export const designProcess: readonly string[] = [
  '**Start from the product** — the goal, who uses the system and what success looks like, before choosing any tool.',
  '**Map what is critical** — key journeys, permissions, sensitive data, latency expectations and external limits.',
  '**Model the domain** — entities, states and transitions, who owns which data, and the real dependencies between modules.',
  '**Begin simple** — propose the simplest architecture that fits the real scope, and say where it stops scaling.',
  '**Plan for failure** — integration errors, retries, consistency, concurrency and what to observe.',
  '**Choose how to ship** — incremental milestones, migrations, rollout and rollback, sized to who will maintain it.',
  '**Make it concrete** — contracts, examples, acceptance criteria, tests and documentation.',
  '**Measure, then adjust** — let real metrics and incidents justify further investment, not preference.',
];

/** The trade-offs he weighs when choosing between options. */
export const decisionCriteria: readonly string[] = [
  'Modular application or separate services',
  'Synchronous request or a queue',
  'Cache or a direct query',
  'Relational storage or a specialized store',
  'A direct API or a Backend for Frontend',
];

/** His day-to-day loop on a feature. */
export const workflow: readonly string[] = [
  'Understand the product goal and the complete user flow.',
  'Map rules, entities, states, integrations, permissions and edge cases.',
  'Define the simplest architecture that holds the real scope.',
  'Build reusable components and modules without giving up readability.',
  'Integrate the UI with real APIs and data — no demo-only screens.',
  'Check design, accessibility, tests, performance and behaviour across devices.',
  'Find the gaps, fix them and repeat until the result matches what was specified.',
];

export interface CaseStudy {
  readonly problem: string;
  readonly angles: readonly string[];
}

/** System design read of his three most recent roles. */
export const caseStudies: Readonly<Partial<Record<RoleId, CaseStudy>>> = {
  toptal: {
    problem:
      'Let several product areas ship consistent, accessible interfaces without duplicating UI decisions or coupling teams to each other — while helping define the architecture of a new product and the APIs behind it.',
    angles: [
      '**UI platform architecture** — contracts between components, composition, reuse and consistency for the teams that consume the library.',
      '**Accessibility as architecture** — a requirement of the foundation, not a late fix on individual screens.',
      '**API and client together** — designing resources and contracts with backend engineers for efficient data fetching.',
      '**A new product** — extensibility, boundaries and flows thought through before every feature is built.',
      '**Influence** — aligning goals set with the Director and CEO with technical and delivery choices.',
    ],
  },
  deel: {
    problem:
      'Evolve the HRIS interfaces and integrate an acquired product (Roots) into a much larger ecosystem with existing users, domains, standards and dependencies — keeping compatibility, performance and consistency while the system changes.',
    angles: [
      '**Integration between platforms** — adapting existing modules and flows to new standards while reducing rollout and maintenance risk.',
      '**Architecture in a large product** — consistent structure, state and error handling to reduce variation between teams.',
      '**Dense corporate data** — fetching cost, pagination, loading behaviour and perceived performance in core screens.',
      '**Trade-offs and delivery** — when to refactor, keep compatibility or stage a change without disrupting users.',
    ],
  },
  roots: {
    problem:
      'Take a young HR product built around Slack, with the frontend essentially in one person’s hands, and create a base that could absorb new features, engineers and users without depending on its original author.',
    angles: [
      '**Boundaries that scale** — components and state organized to support functional growth.',
      '**Frontend and services** — integration with the product’s services with attention to request efficiency.',
      '**Delivery** — GitLab CI pipelines deploying to Amazon S3, and knowledge spread across a growing team.',
      '**Architecture during growth** — changing the structure while keeping product pace and maintainability.',
    ],
  },
};

export interface StackArea {
  readonly area: string;
  readonly items: string;
}

/** How deep the evidence goes for each kind of skill. */
export const skillDepth: readonly StackArea[] = [
  {
    area: 'Strong professional evidence',
    items:
      'React, frontend architecture, performance, Next.js, UI/UX collaboration, technical leadership',
  },
  {
    area: 'Complementary professional evidence',
    items: 'Node.js, REST APIs, microservices, automation, PWAs, system integration',
  },
  {
    area: 'Explored in his own products',
    items:
      'Message queues (NATS/JetStream), RAG and agent workflows, EV charging data (OCPI), game servers and Unreal Engine 5, iOS apps',
  },
];

/** Tools he has used or discussed consistently, by area. */
export const toolset: readonly StackArea[] = [
  {
    area: 'Frontend and UI',
    items:
      'React, Next.js, TypeScript, JavaScript, HTML, CSS, MUI, Tailwind CSS, Formik, Redux, Context API, Zustand, TanStack Query, SWR, design tokens',
  },
  {
    area: 'Testing and quality',
    items:
      'Vitest, frontend testing strategies, code review, pair programming, lint and formatting, error monitoring, Web Vitals',
  },
  {
    area: 'Backend and data',
    items:
      'Node.js, TypeScript, REST APIs, PostgreSQL, Prisma, Redis, authentication and authorization, events and queues',
  },
  {
    area: 'Infrastructure',
    items:
      'Git, GitHub, GitLab CI, AWS (S3, CloudFront), Docker, Nx monorepos, pnpm, Sentry, Datadog',
  },
];

/** Where backend work sits in his career, company by company. */
export const fullStack = {
  summary:
    'Strong full-stack with deep frontend specialization: his strength is connecting decisions across layers — the business flow, entities and responsibilities, the API contract, the interface, failure cases and operation.',
  byCompany: [
    '**Shall And Partners** — the main professional backend record: Node.js, RESTful APIs, microservices with multiple databases, internal automation, and a PWA before the move to native Android.',
    '**Roots** — mostly frontend, with product delivery responsibility: service integration, GitLab CI and deployment to Amazon S3.',
    '**Deel** — frontend and HRIS at the core, working across services, data interfaces and the Roots migration; no authorship of corporate backend services is claimed.',
    '**Toptal** — designs and optimizes REST APIs together with backend engineers.',
  ],
  ownProducts:
    'In his own products he designs Node.js/TypeScript services with domain boundaries, a Backend for Frontend, authentication and RBAC, PostgreSQL with Prisma, Redis, queues, idempotency and the transactional outbox pattern. These are designs and prototypes at different stages, not production systems at an employer.',
} as const;

/** How he uses AI as part of engineering, as he describes it. */
export const aiEngineering = {
  summary:
    'He uses AI as a productivity layer for engineering, not a snippet generator: he prepares context, rules, tasks and checks so agents produce code and documentation worth keeping, and keeps architectural decisions and final acceptance with a person.',
  tools: [
    '**Claude Code** — his main tool today: he documents what to build, splits it into small deliverables and runs Claude Code loops on several of them at once, following each through its summaries and status, with automated tests — browser tests included — before his own review and manual testing.',
    '**OpenAI Codex** — goal-driven implementation and validation loops.',
    '**Cursor** — exploring and editing code.',
  ],
  practices: [
    '**Context engineering** — documentation and decisions kept next to the code, project-specific rules and hooks, instead of one long rules file the agent may ignore.',
    '**Goal-driven loops** — plan, implement, run checks, compare against acceptance criteria, fix the gaps, repeat.',
    '**Prompts as specifications** — purpose, architecture, screens, states, entities, permissions and acceptance criteria written up front.',
    '**Verification** — typecheck, lint, tests, real API integration, UI states, accessibility and a human review of the diff.',
    '**Safety** — least-privilege tools, retrieved content treated as data, secrets kept out of the context.',
  ],
  inProducts:
    'In production, this portfolio is his own LLM application: its assistant retrieves facts by embeddings from his résumé and knowledge base, acts only through an allow-list of validated actions, and has every answer checked by an automated evaluation. He also studies AI inside other products — retrieval over documents, tool calling with permissions and schemas, and keeping deterministic calculations apart from model-written recommendations.',
} as const;

/** How he leads, beyond the titles he held. */
export const leadershipPractice = {
  style:
    'Leadership through influence and execution: he takes part in technical decisions, sets standards, structures systems and proposes improvements beyond his own tasks, while staying close to implementation.',
  balance:
    'He describes his time at Roots as roughly 60% coding and 40% leadership, and at Deel as closer to 80% coding and 20% leadership, at times leading two or three engineers — his own estimates, not audited figures.',
  habits: [
    'Discusses goals with Product and Design before choosing a solution.',
    'Documents contracts and trade-offs, and sequences work by its dependencies.',
    'Sets shared patterns so different engineers ship compatible work.',
    'Plans rollout phases, migration and compatibility.',
    'Treats bugs, observability and maintenance as part of the product.',
  ],
} as const;

/** What he studies on his own, by theme. */
export const studies: readonly string[] = [
  '**Backend and system design** — domain-oriented services, BFFs, authentication, databases, queues and events, idempotency, auditing and observability.',
  '**AI-assisted engineering** — agent workflows, context retrieval, tools, implementation loops and how to evaluate LLM features.',
  '**Data products** — trip and battery data for EvCopilot, training progression for FormDaily, campaign analytics for TargUp.',
  '**Platform and tooling** — AWS, CI/CD, Vercel, Docker, Sentry and Datadog, Nx and pnpm monorepos.',
  '**Online games** — authoritative servers, entity synchronization, inventories, snapshots and rollback, explored with Unreal Engine 5.',
];

export const learningStyle =
  'Problem-driven: he picks a hard user experience, expands its flows end to end, works out which data and services it needs, and researches the technology to build it — connecting tools to a product instead of learning them in isolation.';

/** The engineering problem behind each of his products, as his notes describe it. */
export const productDepth: Readonly<Record<ProjectId, string>> = {
  evcopilot:
    'The engineering question is heterogeneous data and correctable predictions: charger data from Open Charge Map and OCPI, routes with compatible stops, and consumption learned from real trips with the driver’s consent.',
  formdaily:
    'He models trainers, students, exercises, sessions and progression, computes the metrics on the backend and lets AI interpret them — never invent loads — with the trainer reviewing anything critical. Beta builds went out through TestFlight in 2026.',
  targup:
    'A study in reliable asynchronous workflows: campaigns created, scheduled, queued, attempted and confirmed, with idempotency keys and retry policies so a provider timeout never means a duplicate send.',
  fictiondraft:
    'Explores document versioning, role-based editorial permissions, review and translation, and asynchronous import and publishing jobs.',
};

/** What he is looking for next. */
export const goals = {
  roles:
    'Senior or Staff Frontend Engineer, frontend technical leadership, Tech Lead and product engineering roles with architectural autonomy.',
  mode: 'Fully remote, with international teams, working in English.',
  challenges:
    'Complex products, data and AI, design systems, improving existing architecture, performance, quality and cross-discipline technical decisions.',
} as const;

/** Interests the notes mark as strong or recurring; nothing here is a routine. */
export const interests: readonly string[] = [
  '**Games and world-building** — MMORPGs, especially Ragnarok Online-style systems: classes, skills, HUDs, multiplayer servers and creator tools, explored with Unreal Engine.',
  '**Technology and experimentation** — new frameworks, developer tools, AI applied to code and automation.',
  '**Design and product identity** — UI/UX, design systems, typography and turning visual references into working products.',
  '**Electric mobility** — charging, range and road trips, the interest behind EvCopilot.',
];

/** How his scope grew, period by period. */
export const careerArc: readonly string[] = [
  '**2015 — 2018** — technical foundations and autonomy in delivery, from freelance work to complete applications.',
  '**2018 — 2020** — full-stack work: Node.js services, REST APIs and apps across web and mobile.',
  '**2020 — 2022** — specialized frontend with React and Next.js, with ownership and leadership at a startup and in publishing.',
  '**2022 — 2026** — architecture, performance, migration and scale in enterprise software.',
  '**2026** — a shared component library, accessibility and product collaboration with leadership, alongside his own products.',
];

/** The frontend decisions he treats as system design. */
export const frontendArchitecture: readonly string[] = [
  'Presentation components kept apart from state orchestration and service calls.',
  'Module boundaries and reuse rules that avoid circular dependencies and an over-coupled design system.',
  'A deliberate choice between local, global and server state — with caching, invalidation, optimistic updates, deduplication and pagination.',
  'SSR, client rendering, progressive loading, bundle splitting and preloading sized to UX and metrics.',
  'Permissions reflected in the UI without mistaking a hidden button for server-side authorization.',
  'Reusable components that are accessible, responsive and easy to test.',
];

/** How he approaches a performance problem. */
export const performanceApproach: readonly string[] = [
  'Start from real measurement and usage, not premature optimization.',
  'Tell network, server, database, rendering, bundle, data-access and request-waterfall bottlenecks apart.',
  'Use caching and invalidation, pagination, lazy loading and code splitting where they pay off.',
  'Prioritize what users perceive, without losing backend latency and error metrics.',
  'Design logs, tracing, error monitoring and alerts in, especially around integrations and async work.',
];

/** What keeping a codebase healthy means in his practice. */
export const qualityPractices: readonly string[] = [
  'Modules organized by domain, with stable public interfaces and controlled dependencies.',
  'Presentation, business rules and data access kept apart where that removes real coupling.',
  'Loading, failure, empty, retry and authorization states handled explicitly.',
  'TypeScript for contracts, with runtime validation for data that comes from outside.',
  'Unit, integration, contract and end-to-end tests sized to the risk of each flow.',
  'Small, monitored changes to legacy code, with feature flags where useful and a way to roll back.',
  'Decisions, conventions and onboarding written down, so knowledge does not stay in one head.',
];

export const mobileExplorations =
  'In his own products he has also prototyped with React Native and Tamagui and shipped iOS beta builds through TestFlight.';
