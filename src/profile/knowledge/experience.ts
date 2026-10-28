import type { RoleSource } from '@/core/knowledge/schema';

/** Newest first. */
export const experience: readonly RoleSource[] = [
  {
    id: 'way2b1',
    company: 'Way2b1',
    aliases: ['Way 2b1', 'Way2 b1', 'Way 2 b 1'],
    role: 'Senior Frontend Engineer',
    start: '2026-06',
    end: null,
    current: true,
    engagement: 'employment',
    summary: {
      en: 'Full-stack work across the product suite of a small startup: performance, legacy migration and end-to-end features.',
      'pt-BR':
        'Trabalho full stack em todo o conjunto de produtos de uma pequena startup: performance, migração de legado e funcionalidades de ponta a ponta.',
    },
    responsibilities: [
      {
        en: "Works as a full-stack engineer across Way2b1's product suite, at a small San Francisco startup building a platform for families and family offices.",
        'pt-BR':
          'Atua como engenheiro full stack em todo o conjunto de produtos da Way2b1, uma pequena startup de São Francisco que constrói uma plataforma para famílias e family offices.',
      },
      {
        en: 'Cut bundle size by nearly 50% and brought loading times down to a few hundred milliseconds.',
        'pt-BR':
          'Reduziu o tamanho do bundle em quase 50% e baixou os tempos de carregamento para algumas centenas de milissegundos.',
      },
      {
        en: 'Migrated legacy code to a modern, maintainable architecture across multiple products, keeping features stable in production.',
        'pt-BR':
          'Migrou código legado para uma arquitetura moderna e sustentável em vários produtos, mantendo as funcionalidades estáveis em produção.',
      },
      {
        en: 'Delivers features end to end: frontend interfaces, backend services and APIs.',
        'pt-BR':
          'Entrega funcionalidades de ponta a ponta: interfaces de frontend, serviços de backend e APIs.',
      },
    ],
    leadership: [
      {
        en: 'Collaborates across product teams to align technical decisions, share patterns and keep the codebases consistent.',
        'pt-BR':
          'Colabora com os times dos vários produtos para alinhar decisões técnicas, compartilhar padrões e manter as bases de código consistentes.',
      },
    ],
    achievements: [],
    focus: [
      { en: 'Performance', 'pt-BR': 'Performance' },
      { en: 'Legacy code migration', 'pt-BR': 'Migração de código legado' },
      { en: 'Full stack', 'pt-BR': 'Full stack' },
      { en: 'Cross-team work', 'pt-BR': 'Trabalho entre times' },
    ],
    metrics: ['way2b1-bundle', 'way2b1-load'],
    highlights: [
      {
        en: 'Reduced bundle size by nearly 50% and decreased loading times to a few hundred milliseconds.',
        'pt-BR':
          'Reduziu o tamanho do bundle em quase 50% e diminuiu os tempos de carregamento para algumas centenas de milissegundos.',
      },
      {
        en: 'Enhanced application performance platform-wide by refactoring and optimizing critical workflows.',
        'pt-BR':
          'Melhorou a performance da aplicação em toda a plataforma refatorando e otimizando fluxos críticos.',
      },
      {
        en: 'Delivered end-to-end features encompassing frontend interfaces, backend services, and APIs.',
        'pt-BR':
          'Entregou funcionalidades de ponta a ponta abrangendo interfaces de frontend, serviços de backend e APIs.',
      },
      {
        en: "Contributed as a full-stack engineer across Way2b1's product suite at a small San Francisco startup developing a platform for families and family offices.",
        'pt-BR':
          'Contribuiu como engenheiro full stack em todo o conjunto de produtos da Way2b1, uma pequena startup de São Francisco que desenvolve uma plataforma para famílias e family offices.',
      },
      {
        en: 'Migrated legacy code to a modern, maintainable architecture across multiple products, reducing technical debt and maintaining feature stability in production.',
        'pt-BR':
          'Migrou código legado para uma arquitetura moderna e sustentável em vários produtos, reduzindo a dívida técnica e mantendo a estabilidade das funcionalidades em produção.',
      },
      {
        en: 'Collaborated across product teams to align technical decisions, share patterns, and maintain codebase consistency between products.',
        'pt-BR':
          'Colaborou com os times dos vários produtos para alinhar decisões técnicas, compartilhar padrões e manter a consistência das bases de código entre os produtos.',
      },
    ],
    source: 'resume.way2b1',
  },
  {
    id: 'deel',
    company: 'Deel',
    role: 'Senior Frontend Engineer',
    start: '2022',
    end: '2026',
    current: false,
    engagement: 'employment',
    summary: {
      en: 'Helped lead the HRIS team, led the Roots migration, architecture standards and performance work.',
      'pt-BR':
        'Ajudou a liderar o time de HRIS e liderou a migração da Roots, os padrões de arquitetura e o trabalho de performance.',
    },
    responsibilities: [
      {
        en: "Helped lead and maintain the HRIS team responsible for the company's core HR tools product.",
        'pt-BR':
          'Ajudou a liderar e manter o time de HRIS responsável pelo produto central de ferramentas de RH da empresa.',
      },
      {
        en: 'Led the migration and scaling of the Roots platform into Deel, mitigating rollout risks and improving maintainability.',
        'pt-BR':
          'Liderou a migração e a escalabilidade da plataforma Roots dentro da Deel, mitigando os riscos de rollout e melhorando a manutenibilidade.',
      },
      {
        en: 'Standardized frontend architecture for HRIS interfaces, improving structure, state management, error handling and scalability.',
        'pt-BR':
          'Padronizou a arquitetura frontend das interfaces de HRIS, melhorando a estrutura, o gerenciamento de estado, o tratamento de erros e a escalabilidade.',
      },
      {
        en: 'Cut loading time on critical pages by 50% through targeted refactoring and optimization.',
        'pt-BR':
          'Reduziu em 50% o tempo de carregamento das páginas críticas com refatoração e otimização direcionadas.',
      },
    ],
    leadership: [
      {
        en: 'Defined technical trade-offs and delivery plans with Product and Engineering.',
        'pt-BR': 'Definiu trade-offs técnicos e planos de entrega com Produto e Engenharia.',
      },
      {
        en: 'Planned and documented deliveries for OKRs and quarterly goals with Product Managers.',
        'pt-BR':
          'Planejou e documentou entregas para OKRs e metas trimestrais com os Product Managers.',
      },
      {
        en: 'Guided junior and mid-level engineers through structured knowledge-sharing sessions and code walkthroughs.',
        'pt-BR':
          'Orientou engenheiros júnior e pleno com sessões estruturadas de compartilhamento de conhecimento e walkthroughs de código.',
      },
      {
        en: 'Raised quality standards through code reviews and pair programming, and contributed to hiring and onboarding.',
        'pt-BR':
          'Elevou os padrões de qualidade com revisões de código e pair programming, e contribuiu para a contratação e o onboarding.',
      },
    ],
    achievements: [],
    focus: [
      { en: 'HRIS', 'pt-BR': 'HRIS' },
      { en: 'Frontend architecture', 'pt-BR': 'Arquitetura frontend' },
      { en: 'State management', 'pt-BR': 'Gerenciamento de estado' },
      { en: 'Web Vitals', 'pt-BR': 'Web Vitals' },
      { en: 'Mentoring', 'pt-BR': 'Mentoria' },
    ],
    metrics: ['deel-web-vitals', 'deel-critical-load', 'deel-people-list'],
    highlights: [
      {
        en: 'Enhanced user experience metrics by improving web vitals by at least 30%.',
        'pt-BR':
          'Melhorou as métricas de experiência do usuário ao elevar os Web Vitals em pelo menos 30%.',
      },
      {
        en: "Helped lead and maintain the HRIS team responsible for the company's core HR tools product.",
        'pt-BR':
          'Ajudou a liderar e manter o time de HRIS responsável pelo produto central de ferramentas de RH da empresa.',
      },
      {
        en: 'Led the migration and scaling of the Roots platform into Deel, mitigating rollout risks and enhancing maintainability.',
        'pt-BR':
          'Liderou a migração e a escalabilidade da plataforma Roots dentro da Deel, mitigando os riscos de rollout e aumentando a manutenibilidade.',
      },
      {
        en: 'Defined technical trade-offs and delivery plans in collaboration with Product and Engineering teams to deliver scalable solutions.',
        'pt-BR':
          'Definiu trade-offs técnicos e planos de entrega em colaboração com os times de Produto e Engenharia para entregar soluções escaláveis.',
      },
      {
        en: 'Collaborated with Product Managers to plan and document deliveries for OKRs and quarterly goals.',
        'pt-BR':
          'Colaborou com os Product Managers para planejar e documentar entregas para OKRs e metas trimestrais.',
      },
      {
        en: 'Standardized frontend architecture for HRIS interfaces to improve structure, state management, error handling, and scalability across product areas.',
        'pt-BR':
          'Padronizou a arquitetura frontend das interfaces de HRIS para melhorar a estrutura, o gerenciamento de estado, o tratamento de erros e a escalabilidade entre as áreas do produto.',
      },
      {
        en: 'Reduced loading time on critical pages by 50% through targeted refactoring and optimization, decreasing People List page load time from six seconds to three seconds on cold run.',
        'pt-BR':
          'Reduziu em 50% o tempo de carregamento das páginas críticas com refatoração e otimização direcionadas, baixando o carregamento da página People List de seis para três segundos sem cache.',
      },
      {
        en: 'Guided juniors and mid-level engineers via structured knowledge-sharing sessions and code walkthroughs, enhancing team productivity and code quality.',
        'pt-BR':
          'Orientou engenheiros júnior e pleno com sessões estruturadas de compartilhamento de conhecimento e walkthroughs de código, aumentando a produtividade do time e a qualidade do código.',
      },
      {
        en: 'Contributed to the hiring process and onboarding of engineers.',
        'pt-BR': 'Contribuiu para o processo de contratação e o onboarding de engenheiros.',
      },
      {
        en: 'Elevated quality standards and ensured technical consistency by facilitating pair programming sessions, performing code reviews, and supporting onboarding.',
        'pt-BR':
          'Elevou os padrões de qualidade e garantiu consistência técnica conduzindo sessões de pair programming, fazendo revisões de código e apoiando o onboarding.',
      },
    ],
    source: 'resume.deel',
    // "Deel" alone is a disambiguation page; the company's article has its own title.
    reference: { encyclopediaTitle: 'Deel (company)' },
  },
  {
    id: 'roots',
    company: 'Roots',
    role: 'Lead Frontend Engineer',
    start: '2020',
    end: '2022',
    current: false,
    engagement: 'contract',
    summary: {
      en: 'Built the product frontend from the ground up and grew the frontend team from one to four.',
      'pt-BR':
        'Construiu o frontend do produto do zero e ampliou o time de frontend de uma para quatro pessoas.',
    },
    responsibilities: [
      {
        en: 'Built an end-to-end React frontend for a startup creating Slack bots for HR.',
        'pt-BR':
          'Construiu de ponta a ponta um frontend em React para uma startup que cria bots de Slack para RH.',
      },
      {
        en: 'Directed frontend technical strategy and architecture to support user base growth.',
        'pt-BR':
          'Dirigiu a estratégia técnica e a arquitetura do frontend para sustentar o crescimento da base de usuários.',
      },
      {
        en: 'Implemented advanced state management to keep the application scalable and maintainable.',
        'pt-BR':
          'Implementou um gerenciamento de estado avançado para manter a aplicação escalável e sustentável.',
      },
      {
        en: 'Integrated accessibility standards together with UX designers.',
        'pt-BR': 'Integrou padrões de acessibilidade junto com designers de UX.',
      },
      {
        en: 'Set up GitLab CI pipelines deploying to Amazon S3.',
        'pt-BR': 'Montou pipelines de GitLab CI com deploy no Amazon S3.',
      },
    ],
    leadership: [
      {
        en: 'Grew the frontend team from a solo setup by recruiting and integrating three developers.',
        'pt-BR':
          'Ampliou o time de frontend, que tinha um único desenvolvedor, recrutando e integrando três desenvolvedores.',
      },
      {
        en: 'Led frontend development for nearly two years, coordinating sprint planning and deliverables with managers and stakeholders.',
        'pt-BR':
          'Liderou o desenvolvimento frontend por quase dois anos, coordenando o planejamento de sprints e as entregas com gestores e stakeholders.',
      },
      {
        en: 'Organized and delegated work across the engineering team.',
        'pt-BR': 'Organizou e delegou o trabalho dentro do time de engenharia.',
      },
    ],
    achievements: [
      {
        en: "Drove product structure and traction to secure the product's long-term viability.",
        'pt-BR':
          'Impulsionou a estrutura e a tração do produto para garantir sua viabilidade no longo prazo.',
      },
    ],
    focus: [
      { en: 'React', 'pt-BR': 'React' },
      { en: 'State management', 'pt-BR': 'Gerenciamento de estado' },
      { en: 'Accessibility', 'pt-BR': 'Acessibilidade' },
      { en: 'CI/CD', 'pt-BR': 'CI/CD' },
    ],
    metrics: ['roots-team'],
    highlights: [
      {
        en: 'Directed frontend technical strategy and architecture to support user base growth.',
        'pt-BR':
          'Dirigiu a estratégia técnica e a arquitetura do frontend para sustentar o crescimento da base de usuários.',
      },
      {
        en: 'Expanded the frontend team from a solo developer setup by recruiting and integrating three additional developers.',
        'pt-BR':
          'Expandiu o time de frontend, que tinha um único desenvolvedor, recrutando e integrando mais três desenvolvedores.',
      },
      {
        en: 'Led frontend development for nearly two years, coordinating sprint planning and deliverables with managers and stakeholders.',
        'pt-BR':
          'Liderou o desenvolvimento frontend por quase dois anos, coordenando o planejamento de sprints e as entregas com gestores e stakeholders.',
      },
      {
        en: 'Delegated and organized tasks and responsibilities among engineering team members.',
        'pt-BR':
          'Delegou e organizou tarefas e responsabilidades entre os membros do time de engenharia.',
      },
      {
        en: 'Integrated accessibility standards in collaboration with UX designers, enhancing compliance and user experience.',
        'pt-BR':
          'Integrou padrões de acessibilidade em colaboração com designers de UX, melhorando a conformidade e a experiência do usuário.',
      },
      {
        en: 'Implemented advanced state management solutions to enhance application scalability and maintainability.',
        'pt-BR':
          'Implementou soluções avançadas de gerenciamento de estado para aumentar a escalabilidade e a manutenibilidade da aplicação.',
      },
      {
        en: 'Established CI pipelines on GitLab to deploy applications to Amazon S3.',
        'pt-BR':
          'Estabeleceu pipelines de CI no GitLab para fazer deploy das aplicações no Amazon S3.',
      },
      {
        en: 'Developed an end-to-end frontend application with React.js for a startup specializing in Slack bots for HR.',
        'pt-BR':
          'Desenvolveu de ponta a ponta uma aplicação frontend com React.js para uma startup especializada em bots de Slack para RH.',
      },
      {
        en: 'Drove product structure and traction to secure long-term viability.',
        'pt-BR':
          'Impulsionou a estrutura e a tração do produto para garantir a viabilidade no longo prazo.',
      },
    ],
    source: 'resume.roots',
  },
  {
    id: 'maison',
    company: 'Maison Moderne',
    aliases: ['Maison'],
    role: 'Senior Frontend Developer',
    start: '2020',
    end: '2022',
    current: false,
    engagement: 'contract',
    summary: {
      en: 'Responsive digital magazines and newsletters with Next.js, SSR and publishing integrations.',
      'pt-BR':
        'Revistas digitais e newsletters responsivas com Next.js, SSR e integrações com plataformas de publicação.',
    },
    responsibilities: [
      {
        en: 'Developed responsive digital magazines and newsletters with Next.js and React, distributed across multiple countries.',
        'pt-BR':
          'Desenvolveu revistas digitais e newsletters responsivas com Next.js e React, distribuídas em vários países.',
      },
      {
        en: 'Implemented server-side rendering to improve SEO and initial load speed.',
        'pt-BR':
          'Implementou server-side rendering para melhorar o SEO e a velocidade do carregamento inicial.',
      },
      {
        en: 'Delivered scalable frontend solutions integrated with external publishing platforms.',
        'pt-BR':
          'Entregou soluções de frontend escaláveis integradas a plataformas externas de publicação.',
      },
      {
        en: 'Improved usability and performance of editorial products across devices, serving thousands of daily readers.',
        'pt-BR':
          'Melhorou a usabilidade e a performance dos produtos editoriais em todos os dispositivos, atendendo milhares de leitores por dia.',
      },
      {
        en: 'Built intuitive, accessible interfaces from complex requirements with UX designers.',
        'pt-BR':
          'Construiu interfaces intuitivas e acessíveis a partir de requisitos complexos com designers de UX.',
      },
    ],
    leadership: [
      {
        en: 'Led code reviews and established coding standards that reduced bugs and improved maintainability.',
        'pt-BR':
          'Liderou revisões de código e estabeleceu padrões de código que reduziram bugs e melhoraram a manutenibilidade.',
      },
    ],
    achievements: [
      {
        en: 'Contributed to the newsletter project, which achieved a 20% increase in income.',
        'pt-BR':
          'Contribuiu para o projeto de newsletter, que alcançou um aumento de 20% na receita.',
      },
    ],
    focus: [
      { en: 'Next.js', 'pt-BR': 'Next.js' },
      { en: 'React', 'pt-BR': 'React' },
      { en: 'SSR', 'pt-BR': 'SSR' },
      { en: 'SEO', 'pt-BR': 'SEO' },
      { en: 'Accessibility', 'pt-BR': 'Acessibilidade' },
    ],
    metrics: ['maison-newsletter'],
    highlights: [
      {
        en: 'Contributed to the newsletter project, achieving a 20% increase in income.',
        'pt-BR':
          'Contribuiu para o projeto de newsletter, que alcançou um aumento de 20% na receita.',
      },
      {
        en: 'Delivered scalable frontend solutions integrated with external publishing platforms.',
        'pt-BR':
          'Entregou soluções de frontend escaláveis integradas a plataformas externas de publicação.',
      },
      {
        en: 'Implemented server-side rendering solutions to enhance SEO and improve initial load speed.',
        'pt-BR':
          'Implementou soluções de server-side rendering para fortalecer o SEO e melhorar a velocidade do carregamento inicial.',
      },
      {
        en: 'Developed responsive digital magazines and newsletters using Next.js and React for distribution across multiple countries.',
        'pt-BR':
          'Desenvolveu revistas digitais e newsletters responsivas usando Next.js e React, para distribuição em vários países.',
      },
      {
        en: 'Improved usability and performance of editorial products across devices.',
        'pt-BR':
          'Melhorou a usabilidade e a performance dos produtos editoriais em todos os dispositivos.',
      },
      {
        en: 'Collaborated with UX designers to develop intuitive, accessible interfaces from complex requirements.',
        'pt-BR':
          'Colaborou com designers de UX para desenvolver interfaces intuitivas e acessíveis a partir de requisitos complexos.',
      },
      {
        en: 'Led code reviews and established coding standards to reduce bugs and enhance maintainability.',
        'pt-BR':
          'Liderou revisões de código e estabeleceu padrões de código para reduzir bugs e aumentar a manutenibilidade.',
      },
      {
        en: 'Maintained support for daily viewership reaching thousands.',
        'pt-BR': 'Manteve o suporte a uma audiência diária na casa dos milhares.',
      },
    ],
    source: 'resume.maison',
  },
  {
    id: 'shall',
    company: 'Shall And Partners',
    aliases: ['Shall & Partners'],
    role: 'Full Stack Developer',
    start: '2018',
    end: '2020',
    current: false,
    engagement: 'employment',
    summary: {
      en: 'Promoted from mid-level to Principal Frontend Developer on an HR platform; full-stack work with React and Node.js.',
      'pt-BR':
        'Promovido de pleno a Principal Frontend Developer em uma plataforma de RH; trabalho full stack com React e Node.js.',
    },
    responsibilities: [
      {
        en: 'Led development of a progressive web app before the product moved to a native Android app.',
        'pt-BR':
          'Liderou o desenvolvimento de um progressive web app antes de o produto migrar para um app Android nativo.',
      },
      {
        en: 'Refactored the codebase to React Hooks to improve maintainability.',
        'pt-BR': 'Refatorou a base de código para React Hooks para melhorar a manutenibilidade.',
      },
      {
        en: 'Engineered RESTful APIs to improve data exchange between frontend and backend services.',
        'pt-BR':
          'Desenvolveu APIs RESTful para melhorar a troca de dados entre o frontend e os serviços de backend.',
      },
      {
        en: 'Built web and mobile applications in a microservices architecture with Node.js and multiple databases.',
        'pt-BR':
          'Construiu aplicações web e mobile em uma arquitetura de microsserviços com Node.js e vários bancos de dados.',
      },
      {
        en: 'Created internal tools that removed manual contractor timesheet entry by autofilling from prior submissions.',
        'pt-BR':
          'Criou ferramentas internas que eliminaram o preenchimento manual das folhas de horas dos prestadores, preenchendo-as automaticamente a partir de envios anteriores.',
      },
    ],
    leadership: [
      {
        en: 'Promoted from mid-level to Principal Frontend Developer on an HR platform for an American company.',
        'pt-BR':
          'Promovido de pleno a Principal Frontend Developer em uma plataforma de RH de uma empresa americana.',
      },
    ],
    achievements: [
      {
        en: 'Contributed to a web and mobile application that received the Golden Award in 2019.',
        'pt-BR': 'Contribuiu para uma aplicação web e mobile que recebeu o Golden Award em 2019.',
      },
    ],
    focus: [
      { en: 'React', 'pt-BR': 'React' },
      { en: 'Node.js', 'pt-BR': 'Node.js' },
      { en: 'REST APIs', 'pt-BR': 'APIs REST' },
      { en: 'Microservices', 'pt-BR': 'Microsserviços' },
      { en: 'PWA', 'pt-BR': 'PWA' },
    ],
    metrics: [],
    highlights: [
      {
        en: 'Contributed to the development of a web and mobile application that received the Golden Award in 2019.',
        'pt-BR':
          'Contribuiu para o desenvolvimento de uma aplicação web e mobile que recebeu o Golden Award em 2019.',
      },
      {
        en: 'Promoted from Mid-level to Principal Frontend Developer on an HR platform for an American company.',
        'pt-BR':
          'Promovido de pleno a Principal Frontend Developer em uma plataforma de RH de uma empresa americana.',
      },
      {
        en: 'Led development of a progressive web app prior to transitioning to a native Kotlin Android application.',
        'pt-BR':
          'Liderou o desenvolvimento de um progressive web app antes da transição para um aplicativo Android nativo em Kotlin.',
      },
      {
        en: 'Refactored codebase by transitioning to React Hooks to enhance maintainability.',
        'pt-BR':
          'Refatorou a base de código com a transição para React Hooks, aumentando a manutenibilidade.',
      },
      {
        en: 'Created internal tools that eliminated manual contractor timesheet entry by autofilling data based on prior submissions.',
        'pt-BR':
          'Criou ferramentas internas que eliminaram o preenchimento manual das folhas de horas dos prestadores, preenchendo os dados automaticamente com base em envios anteriores.',
      },
      {
        en: 'Engineered RESTful APIs to enhance data exchange between frontend and backend services.',
        'pt-BR':
          'Desenvolveu APIs RESTful para aprimorar a troca de dados entre o frontend e os serviços de backend.',
      },
      {
        en: 'Built web and mobile applications within a microservices architecture using Node.js and multiple databases.',
        'pt-BR':
          'Construiu aplicações web e mobile dentro de uma arquitetura de microsserviços usando Node.js e vários bancos de dados.',
      },
    ],
    source: 'resume.shall',
  },
  {
    id: 'webfi',
    company: 'WEBFI',
    role: 'Frontend Developer',
    start: '2016',
    end: '2018',
    current: false,
    engagement: 'employment',
    summary: {
      en: 'End-to-end frontend delivery for mid-sized applications, from architecture to production.',
      'pt-BR':
        'Entrega de frontend de ponta a ponta para aplicações de médio porte, da arquitetura à produção.',
    },
    responsibilities: [
      {
        en: 'Led end-to-end frontend development for mid-sized applications, from architecture through production delivery.',
        'pt-BR':
          'Liderou o desenvolvimento frontend de ponta a ponta de aplicações de médio porte, da arquitetura à entrega em produção.',
      },
    ],
    leadership: [],
    achievements: [
      {
        en: 'Helped smaller industry clients grow sales by over 30%.',
        'pt-BR': 'Ajudou clientes industriais menores a aumentar as vendas em mais de 30%.',
      },
    ],
    focus: [
      { en: 'Frontend architecture', 'pt-BR': 'Arquitetura frontend' },
      { en: 'Production delivery', 'pt-BR': 'Entrega em produção' },
    ],
    metrics: ['webfi-sales'],
    highlights: [
      {
        en: 'Helped smaller industry clients grow sales by over 30%.',
        'pt-BR': 'Ajudou clientes industriais menores a aumentar as vendas em mais de 30%.',
      },
      {
        en: 'Led end-to-end frontend development for mid-sized applications from architecture through production delivery.',
        'pt-BR':
          'Liderou o desenvolvimento frontend de ponta a ponta de aplicações de médio porte, da arquitetura à entrega em produção.',
      },
    ],
    source: 'resume.webfi',
  },
  {
    id: 'freelance',
    company: 'Freelance',
    aliases: ['Freelancer', 'Freelancing'],
    role: 'Web Developer',
    start: '2015',
    end: '2018',
    current: false,
    engagement: 'contract',
    summary: {
      en: 'Independent web work, from small frontend tasks to complete applications.',
      'pt-BR': 'Trabalho web independente, de pequenas tarefas de frontend a aplicações completas.',
    },
    responsibilities: [
      {
        en: 'Progressed from small frontend tasks to independently developing complete web applications.',
        'pt-BR':
          'Evoluiu de pequenas tarefas de frontend para o desenvolvimento independente de aplicações web completas.',
      },
    ],
    leadership: [],
    achievements: [],
    focus: [
      { en: 'Websites', 'pt-BR': 'Sites' },
      { en: 'Web applications', 'pt-BR': 'Aplicações web' },
    ],
    metrics: [],
    highlights: [
      {
        en: 'Progressed from small frontend tasks to independently developing complete web applications.',
        'pt-BR':
          'Evoluiu de pequenas tarefas de frontend para o desenvolvimento independente de aplicações web completas.',
      },
    ],
    source: 'resume.freelance',
  },
];
