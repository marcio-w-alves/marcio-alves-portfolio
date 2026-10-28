import type { PracticeSource } from '@/core/knowledge/schema';

// How Marcio works, as his knowledge-base notes describe it, condensed into
// English for the pages and the fast path. Each statement keeps the notes'
// evidence level in its own wording: résumé facts are stated plainly, his own
// account is "he describes", and work on his own products is never presented
// as production work at an employer.

export const practice: PracticeSource = {
  /** How he takes a system problem from question to delivery. */
  designProcess: [
    {
      en: '**Start from the product** — the goal, who uses the system and what success looks like, before choosing any tool.',
      'pt-BR':
        '**Começar pelo produto** — o objetivo, quem usa o sistema e como é o sucesso, antes de escolher qualquer ferramenta.',
    },
    {
      en: '**Map what is critical** — key journeys, permissions, sensitive data, latency expectations and external limits.',
      'pt-BR':
        '**Mapear o que é crítico** — jornadas principais, permissões, dados sensíveis, expectativas de latência e limites externos.',
    },
    {
      en: '**Model the domain** — entities, states and transitions, who owns which data, and the real dependencies between modules.',
      'pt-BR':
        '**Modelar o domínio** — entidades, estados e transições, quem é dono de cada dado e as dependências reais entre módulos.',
    },
    {
      en: '**Begin simple** — propose the simplest architecture that fits the real scope, and say where it stops scaling.',
      'pt-BR':
        '**Começar simples** — propor a arquitetura mais simples que atende ao escopo real e dizer onde ela deixa de escalar.',
    },
    {
      en: '**Plan for failure** — integration errors, retries, consistency, concurrency and what to observe.',
      'pt-BR':
        '**Planejar para a falha** — erros de integração, novas tentativas, consistência, concorrência e o que observar.',
    },
    {
      en: '**Choose how to ship** — incremental milestones, migrations, rollout and rollback, sized to who will maintain it.',
      'pt-BR':
        '**Escolher como entregar** — marcos incrementais, migrações, rollout e rollback, na medida de quem vai manter.',
    },
    {
      en: '**Make it concrete** — contracts, examples, acceptance criteria, tests and documentation.',
      'pt-BR':
        '**Tornar concreto** — contratos, exemplos, critérios de aceite, testes e documentação.',
    },
    {
      en: '**Measure, then adjust** — let real metrics and incidents justify further investment, not preference.',
      'pt-BR':
        '**Medir e depois ajustar** — deixar que métricas e incidentes reais justifiquem novos investimentos, não a preferência.',
    },
  ],

  /** The trade-offs he weighs when choosing between options. */
  decisionCriteria: [
    {
      en: 'Modular application or separate services',
      'pt-BR': 'Aplicação modular ou serviços separados',
    },
    { en: 'Synchronous request or a queue', 'pt-BR': 'Requisição síncrona ou fila' },
    { en: 'Cache or a direct query', 'pt-BR': 'Cache ou consulta direta' },
    {
      en: 'Relational storage or a specialized store',
      'pt-BR': 'Banco relacional ou armazenamento especializado',
    },
    { en: 'A direct API or a Backend for Frontend', 'pt-BR': 'API direta ou Backend for Frontend' },
  ],

  /** His day-to-day loop on a feature. */
  workflow: [
    {
      en: 'Understand the product goal and the complete user flow.',
      'pt-BR': 'Entender o objetivo do produto e o fluxo completo do usuário.',
    },
    {
      en: 'Map rules, entities, states, integrations, permissions and edge cases.',
      'pt-BR': 'Mapear regras, entidades, estados, integrações, permissões e casos de borda.',
    },
    {
      en: 'Define the simplest architecture that holds the real scope.',
      'pt-BR': 'Definir a arquitetura mais simples que sustenta o escopo real.',
    },
    {
      en: 'Build reusable components and modules without giving up readability.',
      'pt-BR': 'Construir componentes e módulos reutilizáveis sem abrir mão da legibilidade.',
    },
    {
      en: 'Integrate the UI with real APIs and data — no demo-only screens.',
      'pt-BR': 'Integrar a interface com APIs e dados reais — nada de telas só de demonstração.',
    },
    {
      en: 'Check design, accessibility, tests, performance and behaviour across devices.',
      'pt-BR':
        'Conferir design, acessibilidade, testes, performance e comportamento em todos os dispositivos.',
    },
    {
      en: 'Find the gaps, fix them and repeat until the result matches what was specified.',
      'pt-BR':
        'Encontrar as lacunas, corrigi-las e repetir até que o resultado corresponda ao que foi especificado.',
    },
  ],

  /** System design read of his three most recent roles. */
  caseStudies: {
    way2b1: {
      problem: {
        en: "Keep the products of a small startup moving while migrating their legacy code and improving their performance — working across the products' teams rather than inside one of them.",
        'pt-BR':
          'Manter os produtos de uma pequena startup em movimento enquanto migra o código legado e melhora a performance deles — trabalhando com os times de todos os produtos, e não dentro de um só.',
      },
      angles: [
        {
          en: '**Legacy migration** — moving old code to a modern, maintainable base while the products keep running.',
          'pt-BR':
            '**Migração de legado** — levar código antigo para uma base moderna e sustentável enquanto os produtos seguem no ar.',
        },
        {
          en: '**Performance** — finding what slows each product down and fixing it.',
          'pt-BR': '**Performance** — descobrir o que deixa cada produto lento e corrigir.',
        },
        {
          en: "**Across products** — working with each product's team so changes stay consistent between them.",
          'pt-BR':
            '**Entre produtos** — trabalhar com o time de cada produto para que as mudanças fiquem consistentes entre eles.',
        },
        {
          en: '**Full stack** — from the interfaces to the services behind them.',
          'pt-BR': '**Full stack** — das interfaces aos serviços por trás delas.',
        },
      ],
    },
    deel: {
      problem: {
        en: 'Evolve the HRIS interfaces and integrate an acquired product (Roots) into a much larger ecosystem with existing users, domains, standards and dependencies — keeping compatibility, performance and consistency while the system changes.',
        'pt-BR':
          'Evoluir as interfaces de HRIS e integrar um produto adquirido (Roots) a um ecossistema muito maior, com usuários, domínios, padrões e dependências já existentes — mantendo compatibilidade, performance e consistência enquanto o sistema muda.',
      },
      angles: [
        {
          en: '**Integration between platforms** — adapting existing modules and flows to new standards while reducing rollout and maintenance risk.',
          'pt-BR':
            '**Integração entre plataformas** — adaptar módulos e fluxos existentes a novos padrões, reduzindo o risco de rollout e de manutenção.',
        },
        {
          en: '**Architecture in a large product** — consistent structure, state and error handling to reduce variation between teams.',
          'pt-BR':
            '**Arquitetura em um produto grande** — estrutura, estado e tratamento de erros consistentes para reduzir a variação entre times.',
        },
        {
          en: '**Dense corporate data** — fetching cost, pagination, loading behaviour and perceived performance in core screens.',
          'pt-BR':
            '**Dados corporativos densos** — custo de busca, paginação, comportamento de carregamento e performance percebida nas telas principais.',
        },
        {
          en: '**Trade-offs and delivery** — when to refactor, keep compatibility or stage a change without disrupting users.',
          'pt-BR':
            '**Trade-offs e entrega** — quando refatorar, manter compatibilidade ou escalonar uma mudança sem atrapalhar os usuários.',
        },
      ],
    },
    roots: {
      problem: {
        en: 'Take a young HR product built around Slack, with the frontend essentially in one person’s hands, and create a base that could absorb new features, engineers and users without depending on its original author.',
        'pt-BR':
          'Pegar um produto de RH jovem, construído em torno do Slack, com o frontend praticamente nas mãos de uma pessoa, e criar uma base capaz de absorver novas funcionalidades, engenheiros e usuários sem depender do autor original.',
      },
      angles: [
        {
          en: '**Boundaries that scale** — components and state organized to support functional growth.',
          'pt-BR':
            '**Fronteiras que escalam** — componentes e estado organizados para sustentar o crescimento funcional.',
        },
        {
          en: '**Frontend and services** — integration with the product’s services with attention to request efficiency.',
          'pt-BR':
            '**Frontend e serviços** — integração com os serviços do produto, com atenção à eficiência das requisições.',
        },
        {
          en: '**Delivery** — GitLab CI pipelines deploying to Amazon S3, and knowledge spread across a growing team.',
          'pt-BR':
            '**Entrega** — pipelines de GitLab CI com deploy no Amazon S3 e conhecimento distribuído em um time em crescimento.',
        },
        {
          en: '**Architecture during growth** — changing the structure while keeping product pace and maintainability.',
          'pt-BR':
            '**Arquitetura durante o crescimento** — mudar a estrutura mantendo o ritmo do produto e a manutenibilidade.',
        },
      ],
    },
  },

  /** How deep the evidence goes for each kind of skill. */
  skillDepth: [
    {
      area: { en: 'Strong professional evidence', 'pt-BR': 'Evidência profissional sólida' },
      items: {
        en: 'React, frontend architecture, performance, Next.js, UI/UX collaboration, technical leadership',
        'pt-BR':
          'React, arquitetura frontend, performance, Next.js, colaboração com UI/UX, liderança técnica',
      },
    },
    {
      area: {
        en: 'Complementary professional evidence',
        'pt-BR': 'Evidência profissional complementar',
      },
      items: {
        en: 'Node.js, REST APIs, microservices, automation, PWAs, system integration',
        'pt-BR': 'Node.js, APIs REST, microsserviços, automação, PWAs, integração de sistemas',
      },
    },
    {
      area: { en: 'Explored in his own products', 'pt-BR': 'Explorado nos produtos próprios' },
      items: {
        en: 'Message queues (NATS/JetStream), RAG and agent workflows, EV charging data (OCPI), game servers and Unreal Engine 5, iOS apps',
        'pt-BR':
          'Filas de mensagens (NATS/JetStream), RAG e fluxos com agentes, dados de recarga de veículos elétricos (OCPI), servidores de jogos e Unreal Engine 5, apps iOS',
      },
    },
  ],

  /** Tools he has used or discussed consistently, by area. */
  toolset: [
    {
      area: { en: 'Frontend and UI', 'pt-BR': 'Frontend e UI' },
      items: {
        en: 'React, Next.js, TypeScript, JavaScript, HTML, CSS, MUI, Tailwind CSS, Formik, Redux, Context API, Zustand, TanStack Query, SWR, design tokens',
        'pt-BR':
          'React, Next.js, TypeScript, JavaScript, HTML, CSS, MUI, Tailwind CSS, Formik, Redux, Context API, Zustand, TanStack Query, SWR, design tokens',
      },
    },
    {
      area: { en: 'Testing and quality', 'pt-BR': 'Testes e qualidade' },
      items: {
        en: 'Vitest, frontend testing strategies, code review, pair programming, lint and formatting, error monitoring, Web Vitals',
        'pt-BR':
          'Vitest, estratégias de teste de frontend, revisão de código, pair programming, lint e formatação, monitoramento de erros, Web Vitals',
      },
    },
    {
      area: { en: 'Backend and data', 'pt-BR': 'Backend e dados' },
      items: {
        en: 'Node.js, TypeScript, REST APIs, PostgreSQL, Prisma, Redis, authentication and authorization, events and queues',
        'pt-BR':
          'Node.js, TypeScript, APIs REST, PostgreSQL, Prisma, Redis, autenticação e autorização, eventos e filas',
      },
    },
    {
      area: { en: 'Infrastructure', 'pt-BR': 'Infraestrutura' },
      items: {
        en: 'Git, GitHub, GitLab CI, AWS (S3, CloudFront), Docker, Nx monorepos, pnpm, Sentry, Datadog',
        'pt-BR':
          'Git, GitHub, GitLab CI, AWS (S3, CloudFront), Docker, monorepos Nx, pnpm, Sentry, Datadog',
      },
    },
  ],

  /** Where backend work sits in his career, company by company. */
  fullStack: {
    summary: {
      en: 'Strong full-stack with deep frontend specialization: his strength is connecting decisions across layers — the business flow, entities and responsibilities, the API contract, the interface, failure cases and operation.',
      'pt-BR':
        'Full stack sólido com especialização profunda em frontend: o ponto forte dele é conectar decisões entre camadas — o fluxo de negócio, entidades e responsabilidades, o contrato da API, a interface, os casos de falha e a operação.',
    },
    byCompany: [
      {
        en: '**Shall And Partners** — the main professional backend record: Node.js, RESTful APIs, microservices with multiple databases, internal automation, and a PWA before the move to native Android.',
        'pt-BR':
          '**Shall And Partners** — o principal registro profissional de backend: Node.js, APIs RESTful, microsserviços com vários bancos de dados, automação interna e um PWA antes da mudança para Android nativo.',
      },
      {
        en: '**Roots** — mostly frontend, with product delivery responsibility: service integration, GitLab CI and deployment to Amazon S3.',
        'pt-BR':
          '**Roots** — principalmente frontend, com responsabilidade pela entrega do produto: integração de serviços, GitLab CI e deploy no Amazon S3.',
      },
      {
        en: '**Deel** — frontend and HRIS at the core, working across services, data interfaces and the Roots migration; no authorship of corporate backend services is claimed.',
        'pt-BR':
          '**Deel** — frontend e HRIS no centro, trabalhando com serviços, interfaces de dados e a migração da Roots; não há autoria declarada de serviços corporativos de backend.',
      },
      {
        en: "**Way2b1** — full-stack work across the startup's products, frontend and backend.",
        'pt-BR':
          '**Way2b1** — trabalho full stack em todos os produtos da startup, no frontend e no backend.',
      },
    ],
    ownProducts: {
      en: 'In his own products he designs Node.js/TypeScript services with domain boundaries, a Backend for Frontend, authentication and RBAC, PostgreSQL with Prisma, Redis, queues, idempotency and the transactional outbox pattern. These are designs and prototypes at different stages, not production systems at an employer.',
      'pt-BR':
        'Nos produtos próprios, ele projeta serviços em Node.js/TypeScript com fronteiras de domínio, um Backend for Frontend, autenticação e RBAC, PostgreSQL com Prisma, Redis, filas, idempotência e o padrão transactional outbox. São designs e protótipos em estágios diferentes, não sistemas em produção em um empregador.',
    },
  },

  /** How he uses AI as part of engineering, as he describes it. */
  aiEngineering: {
    summary: {
      en: 'He uses AI as a productivity layer for engineering, not a snippet generator: he prepares context, rules, tasks and checks so agents produce code and documentation worth keeping, and keeps architectural decisions and final acceptance with a person.',
      'pt-BR':
        'Ele usa IA como uma camada de produtividade para a engenharia, não como gerador de trechos de código: prepara contexto, regras, tarefas e verificações para que os agentes produzam código e documentação que valham a pena manter, e deixa as decisões de arquitetura e o aceite final com uma pessoa.',
    },
    tools: [
      {
        en: '**Claude Code** — his main tool today: he documents what to build, splits it into small deliverables and runs Claude Code loops on several of them at once, following each through its summaries and status, with automated tests — browser tests included — before his own review and manual testing.',
        'pt-BR':
          '**Claude Code** — a principal ferramenta dele hoje: ele documenta o que construir, divide em entregas pequenas e roda loops do Claude Code em várias delas ao mesmo tempo, acompanhando cada uma pelos resumos e pelo status, com testes automatizados — inclusive testes no navegador — antes da própria revisão e dos testes manuais.',
      },
      {
        en: '**OpenAI Codex** — goal-driven implementation and validation loops.',
        'pt-BR': '**OpenAI Codex** — loops de implementação e validação guiados por objetivos.',
      },
      {
        en: '**Cursor** — exploring and editing code.',
        'pt-BR': '**Cursor** — explorar e editar código.',
      },
    ],
    practices: [
      {
        en: '**Context engineering** — documentation and decisions kept next to the code, project-specific rules and hooks, instead of one long rules file the agent may ignore.',
        'pt-BR':
          '**Engenharia de contexto** — documentação e decisões mantidas junto ao código, regras e hooks específicos de cada projeto, em vez de um único arquivo longo de regras que o agente pode ignorar.',
      },
      {
        en: '**Goal-driven loops** — plan, implement, run checks, compare against acceptance criteria, fix the gaps, repeat.',
        'pt-BR':
          '**Loops guiados por objetivos** — planejar, implementar, rodar verificações, comparar com os critérios de aceite, corrigir as lacunas, repetir.',
      },
      {
        en: '**Prompts as specifications** — purpose, architecture, screens, states, entities, permissions and acceptance criteria written up front.',
        'pt-BR':
          '**Prompts como especificações** — propósito, arquitetura, telas, estados, entidades, permissões e critérios de aceite escritos de antemão.',
      },
      {
        en: '**Verification** — typecheck, lint, tests, real API integration, UI states, accessibility and a human review of the diff.',
        'pt-BR':
          '**Verificação** — typecheck, lint, testes, integração com APIs reais, estados da interface, acessibilidade e uma revisão humana do diff.',
      },
      {
        en: '**Safety** — least-privilege tools, retrieved content treated as data, secrets kept out of the context.',
        'pt-BR':
          '**Segurança** — ferramentas com privilégio mínimo, conteúdo recuperado tratado como dado e segredos mantidos fora do contexto.',
      },
    ],
    inProducts: {
      en: 'In production, this portfolio is his own LLM application: its assistant retrieves facts by embeddings from his résumé and knowledge base, acts only through an allow-list of validated actions, and has every answer checked by an automated evaluation. He also studies AI inside other products — retrieval over documents, tool calling with permissions and schemas, and keeping deterministic calculations apart from model-written recommendations.',
      'pt-BR':
        'Em produção, este portfólio é a aplicação de LLM dele: o assistente recupera fatos por embeddings a partir do currículo e da base de conhecimento dele, age apenas por uma lista fechada de ações validadas e tem cada resposta conferida por uma avaliação automatizada. Ele também estuda IA dentro de outros produtos — busca em documentos, tool calling com permissões e schemas, e a separação entre cálculos determinísticos e recomendações escritas pelo modelo.',
    },
  },

  /** How he leads, beyond the titles he held. */
  leadershipPractice: {
    style: {
      en: 'Leadership through influence and execution: he takes part in technical decisions, sets standards, structures systems and proposes improvements beyond his own tasks, while staying close to implementation.',
      'pt-BR':
        'Liderança pela influência e pela execução: ele participa das decisões técnicas, define padrões, estrutura sistemas e propõe melhorias além das próprias tarefas, sem se afastar da implementação.',
    },
    balance: {
      en: 'He describes his time at Roots as roughly 60% coding and 40% leadership, and at Deel as closer to 80% coding and 20% leadership, at times leading two or three engineers — his own estimates, not audited figures.',
      'pt-BR':
        'Ele descreve o tempo na Roots como cerca de 60% de código e 40% de liderança, e na Deel como algo mais próximo de 80% de código e 20% de liderança, às vezes liderando dois ou três engenheiros — estimativas dele, não números auditados.',
    },
    habits: [
      {
        en: 'Discusses goals with Product and Design before choosing a solution.',
        'pt-BR': 'Discute os objetivos com Produto e Design antes de escolher uma solução.',
      },
      {
        en: 'Documents contracts and trade-offs, and sequences work by its dependencies.',
        'pt-BR': 'Documenta contratos e trade-offs, e ordena o trabalho pelas dependências.',
      },
      {
        en: 'Sets shared patterns so different engineers ship compatible work.',
        'pt-BR':
          'Define padrões compartilhados para que engenheiros diferentes entreguem trabalho compatível.',
      },
      {
        en: 'Plans rollout phases, migration and compatibility.',
        'pt-BR': 'Planeja fases de rollout, migração e compatibilidade.',
      },
      {
        en: 'Treats bugs, observability and maintenance as part of the product.',
        'pt-BR': 'Trata bugs, observabilidade e manutenção como parte do produto.',
      },
    ],
  },

  /** What he studies on his own, by theme. */
  studies: [
    {
      en: '**Backend and system design** — domain-oriented services, BFFs, authentication, databases, queues and events, idempotency, auditing and observability.',
      'pt-BR':
        '**Backend e system design** — serviços orientados a domínio, BFFs, autenticação, bancos de dados, filas e eventos, idempotência, auditoria e observabilidade.',
    },
    {
      en: '**AI-assisted engineering** — agent workflows, context retrieval, tools, implementation loops and how to evaluate LLM features.',
      'pt-BR':
        '**Engenharia assistida por IA** — fluxos com agentes, recuperação de contexto, ferramentas, loops de implementação e como avaliar funcionalidades com LLM.',
    },
    {
      en: '**Data products** — trip and battery data for EvCopilot, training progression for FormDaily, campaign analytics for TargUp.',
      'pt-BR':
        '**Produtos de dados** — dados de viagem e bateria para o EvCopilot, progressão de treinos para o FormDaily, análise de campanhas para o TargUp.',
    },
    {
      en: '**Platform and tooling** — AWS, CI/CD, Vercel, Docker, Sentry and Datadog, Nx and pnpm monorepos.',
      'pt-BR':
        '**Plataforma e ferramentas** — AWS, CI/CD, Vercel, Docker, Sentry e Datadog, monorepos com Nx e pnpm.',
    },
    {
      en: '**Online games** — authoritative servers, entity synchronization, inventories, snapshots and rollback, explored with Unreal Engine 5.',
      'pt-BR':
        '**Jogos online** — servidores autoritativos, sincronização de entidades, inventários, snapshots e rollback, explorados com Unreal Engine 5.',
    },
  ],

  learningStyle: {
    en: 'Problem-driven: he picks a hard user experience, expands its flows end to end, works out which data and services it needs, and researches the technology to build it — connecting tools to a product instead of learning them in isolation.',
    'pt-BR':
      'Guiado por problemas: ele escolhe uma experiência de usuário difícil, desdobra os fluxos de ponta a ponta, descobre de quais dados e serviços ela precisa e pesquisa a tecnologia para construí-la — ligando as ferramentas a um produto em vez de aprendê-las isoladamente.',
  },

  /** The engineering problem behind each of his products, as his notes describe it. */
  productDepth: {
    evcopilot: {
      en: 'The engineering question is heterogeneous data and correctable predictions: charger data from Open Charge Map and OCPI, routes with compatible stops, and consumption learned from real trips with the driver’s consent.',
      'pt-BR':
        'A questão de engenharia são dados heterogêneos e previsões corrigíveis: dados de carregadores do Open Charge Map e do OCPI, rotas com paradas compatíveis e consumo aprendido com viagens reais, com o consentimento do motorista.',
    },
    formdaily: {
      en: 'He models trainers, students, exercises, sessions and progression, computes the metrics on the backend and lets AI interpret them — never invent loads — with the trainer reviewing anything critical. Beta builds went out through TestFlight in 2026.',
      'pt-BR':
        'Ele modela treinadores, alunos, exercícios, sessões e progressão, calcula as métricas no backend e deixa a IA interpretá-las — nunca inventar cargas —, com o treinador revisando tudo o que é crítico. Versões beta foram distribuídas pelo TestFlight em 2026.',
    },
    targup: {
      en: 'A study in reliable asynchronous workflows: campaigns created, scheduled, queued, attempted and confirmed, with idempotency keys and retry policies so a provider timeout never means a duplicate send.',
      'pt-BR':
        'Um estudo de fluxos assíncronos confiáveis: campanhas criadas, agendadas, enfileiradas, tentadas e confirmadas, com chaves de idempotência e políticas de nova tentativa para que um timeout do provedor nunca vire um envio duplicado.',
    },
    'marciomariani-dev': {
      en: 'A study in grounding a language model: it acts only through a closed list of validated tools, retrieves facts by embeddings with source tags and a relevance floor, and an offline evaluation has a second model grade its answers claim by claim against the evidence.',
      'pt-BR':
        'Um estudo de como ancorar um modelo de linguagem: ele age apenas por uma lista fechada de ferramentas validadas, recupera fatos por embeddings com marcação de fontes e um piso de relevância, e uma avaliação offline faz um segundo modelo conferir as respostas afirmação por afirmação contra as evidências.',
    },
    fictiondraft: {
      en: 'Explores document versioning, role-based editorial permissions, review and translation, and asynchronous import and publishing jobs.',
      'pt-BR':
        'Explora versionamento de documentos, permissões editoriais por papel, revisão e tradução, e jobs assíncronos de importação e publicação.',
    },
  },

  /** What he is looking for next. */
  goals: {
    roles: {
      en: 'Senior Frontend or Senior Full Stack Engineer roles, and Tech Lead roles that match his interests.',
      'pt-BR':
        'Vagas de Senior Frontend ou Senior Full Stack Engineer, e de Tech Lead que combinem com os interesses dele.',
    },
    mode: {
      en: 'Fully remote, with international teams, working in English.',
      'pt-BR': 'Totalmente remoto, com times internacionais, trabalhando em inglês.',
    },
    challenges: {
      en: 'Complex products, data and AI, design systems, improving existing architecture, performance, quality and cross-discipline technical decisions.',
      'pt-BR':
        'Produtos complexos, dados e IA, design systems, melhoria de arquiteturas existentes, performance, qualidade e decisões técnicas entre disciplinas.',
    },
  },

  /** Interests the notes mark as strong or recurring; nothing here is a routine. */
  interests: [
    {
      en: '**Games and world-building** — MMORPGs, especially Ragnarok Online-style systems: classes, skills, HUDs, multiplayer servers and creator tools, explored with Unreal Engine.',
      'pt-BR':
        '**Jogos e construção de mundos** — MMORPGs, especialmente sistemas no estilo de Ragnarok Online: classes, habilidades, HUDs, servidores multiplayer e ferramentas para criadores, explorados com Unreal Engine.',
    },
    {
      en: '**Technology and experimentation** — new frameworks, developer tools, AI applied to code and automation.',
      'pt-BR':
        '**Tecnologia e experimentação** — novos frameworks, ferramentas para desenvolvedores, IA aplicada a código e automação.',
    },
    {
      en: '**Design and product identity** — UI/UX, design systems, typography and turning visual references into working products.',
      'pt-BR':
        '**Design e identidade de produto** — UI/UX, design systems, tipografia e a transformação de referências visuais em produtos funcionando.',
    },
    {
      en: '**Electric mobility** — charging, range and road trips, the interest behind EvCopilot.',
      'pt-BR':
        '**Mobilidade elétrica** — recarga, autonomia e viagens de carro, o interesse por trás do EvCopilot.',
    },
  ],

  /** How his scope grew, period by period. */
  careerArc: [
    {
      en: '**2015 — 2018** — technical foundations and autonomy in delivery, from freelance work to complete applications.',
      'pt-BR':
        '**2015 — 2018** — base técnica e autonomia nas entregas, do trabalho freelance a aplicações completas.',
    },
    {
      en: '**2018 — 2020** — full-stack work: Node.js services, REST APIs and apps across web and mobile.',
      'pt-BR':
        '**2018 — 2020** — trabalho full stack: serviços em Node.js, APIs REST e apps para web e mobile.',
    },
    {
      en: '**2020 — 2022** — specialized frontend with React and Next.js, with ownership and leadership at a startup and in publishing.',
      'pt-BR':
        '**2020 — 2022** — frontend especializado com React e Next.js, com ownership e liderança em uma startup e no mercado editorial.',
    },
    {
      en: '**2022 — 2026** — architecture, performance, migration and scale in enterprise software.',
      'pt-BR':
        '**2022 — 2026** — arquitetura, performance, migração e escala em software corporativo.',
    },
    {
      en: '**2026** — a shared component library, accessibility and product collaboration with leadership, alongside his own products.',
      'pt-BR':
        '**2026** — uma biblioteca de componentes compartilhada, acessibilidade e colaboração de produto com a liderança, ao lado dos produtos próprios.',
    },
  ],

  /** The frontend decisions he treats as system design. */
  frontendArchitecture: [
    {
      en: 'Presentation components kept apart from state orchestration and service calls.',
      'pt-BR':
        'Componentes de apresentação separados da orquestração de estado e das chamadas a serviços.',
    },
    {
      en: 'Module boundaries and reuse rules that avoid circular dependencies and an over-coupled design system.',
      'pt-BR':
        'Fronteiras de módulos e regras de reuso que evitam dependências circulares e um design system acoplado demais.',
    },
    {
      en: 'A deliberate choice between local, global and server state — with caching, invalidation, optimistic updates, deduplication and pagination.',
      'pt-BR':
        'Uma escolha deliberada entre estado local, global e de servidor — com cache, invalidação, atualizações otimistas, deduplicação e paginação.',
    },
    {
      en: 'SSR, client rendering, progressive loading, bundle splitting and preloading sized to UX and metrics.',
      'pt-BR':
        'SSR, renderização no cliente, carregamento progressivo, divisão de bundle e pré-carregamento na medida da UX e das métricas.',
    },
    {
      en: 'Permissions reflected in the UI without mistaking a hidden button for server-side authorization.',
      'pt-BR':
        'Permissões refletidas na interface sem confundir um botão escondido com autorização no servidor.',
    },
    {
      en: 'Reusable components that are accessible, responsive and easy to test.',
      'pt-BR': 'Componentes reutilizáveis, acessíveis, responsivos e fáceis de testar.',
    },
  ],

  /** How he approaches a performance problem. */
  performanceApproach: [
    {
      en: 'Start from real measurement and usage, not premature optimization.',
      'pt-BR': 'Partir de medições e de uso reais, não de otimização prematura.',
    },
    {
      en: 'Tell network, server, database, rendering, bundle, data-access and request-waterfall bottlenecks apart.',
      'pt-BR':
        'Distinguir gargalos de rede, servidor, banco de dados, renderização, bundle, acesso a dados e cascata de requisições.',
    },
    {
      en: 'Use caching and invalidation, pagination, lazy loading and code splitting where they pay off.',
      'pt-BR':
        'Usar cache e invalidação, paginação, lazy loading e code splitting onde valem a pena.',
    },
    {
      en: 'Prioritize what users perceive, without losing backend latency and error metrics.',
      'pt-BR':
        'Priorizar o que os usuários percebem, sem perder de vista a latência do backend e as métricas de erro.',
    },
    {
      en: 'Design logs, tracing, error monitoring and alerts in, especially around integrations and async work.',
      'pt-BR':
        'Projetar desde o início logs, tracing, monitoramento de erros e alertas, sobretudo em integrações e trabalho assíncrono.',
    },
  ],

  /** What keeping a codebase healthy means in his practice. */
  qualityPractices: [
    {
      en: 'Modules organized by domain, with stable public interfaces and controlled dependencies.',
      'pt-BR':
        'Módulos organizados por domínio, com interfaces públicas estáveis e dependências controladas.',
    },
    {
      en: 'Presentation, business rules and data access kept apart where that removes real coupling.',
      'pt-BR':
        'Apresentação, regras de negócio e acesso a dados separados onde isso elimina acoplamento real.',
    },
    {
      en: 'Loading, failure, empty, retry and authorization states handled explicitly.',
      'pt-BR':
        'Estados de carregamento, falha, vazio, nova tentativa e autorização tratados explicitamente.',
    },
    {
      en: 'TypeScript for contracts, with runtime validation for data that comes from outside.',
      'pt-BR':
        'TypeScript para contratos, com validação em tempo de execução para dados que vêm de fora.',
    },
    {
      en: 'Unit, integration, contract and end-to-end tests sized to the risk of each flow.',
      'pt-BR':
        'Testes unitários, de integração, de contrato e end-to-end na medida do risco de cada fluxo.',
    },
    {
      en: 'Small, monitored changes to legacy code, with feature flags where useful and a way to roll back.',
      'pt-BR':
        'Mudanças pequenas e monitoradas no código legado, com feature flags onde for útil e um caminho de rollback.',
    },
    {
      en: 'Decisions, conventions and onboarding written down, so knowledge does not stay in one head.',
      'pt-BR':
        'Decisões, convenções e onboarding registrados por escrito, para que o conhecimento não fique na cabeça de uma só pessoa.',
    },
  ],

  mobileExplorations: {
    en: 'In his own products he has also prototyped with React Native and Tamagui and shipped iOS beta builds through TestFlight.',
    'pt-BR':
      'Nos produtos próprios, ele também prototipou com React Native e Tamagui e distribuiu versões beta para iOS pelo TestFlight.',
  },
};
