import type { KnowledgeSource, Localized } from '@/core/knowledge/schema';

/**
 * A fictional person's record, complete enough to validate, localize and
 * answer from. Tests that are about how the record is handled use it, so
 * they assert values nobody's real résumé contains.
 */

const t = (en: string, pt: string): Localized => ({ en, 'pt-BR': pt });

export const fixtureKnowledge: KnowledgeSource = {
  profile: {
    name: 'Ada Rivera',
    firstName: 'Ada',
    initials: 'AR',
    title: t('Principal Platform Engineer', 'Principal Platform Engineer'),
    yearsLabel: t('12 years', '12 anos'),
    careerStartYear: 2012,
    specializations: [
      t('Platform engineering', 'Engenharia de plataforma'),
      t('Developer tooling', 'Ferramentas para desenvolvedores'),
    ],
    summary: t(
      'Ada is a platform engineer who builds internal developer platforms.',
      'Ada é uma engenheira de plataforma que constrói plataformas internas para desenvolvedores.',
    ),
    context: t(
      'She designs build systems and the tooling around them.',
      'Ela projeta sistemas de build e as ferramentas em torno deles.',
    ),
    focus: t(
      'She plans platform roadmaps with product teams.',
      'Ela planeja roadmaps de plataforma com os times de produto.',
    ),
    location: { country: t('Portugal', 'Portugal'), city: 'Porto' },
    availability: t(
      'Portugal · hybrid · UTC+0 · open to platform roles',
      'Portugal · híbrido · UTC+0 · aberta a vagas de plataforma',
    ),
    photoUrl: null,
    source: 'cv',
  },
  welcome: {
    heading: t("Hi, I'm Ada", 'Olá, eu sou a Ada'),
    description: t(
      'Platform engineer. Ask about my work.',
      'Engenheira de plataforma. Pergunte sobre meu trabalho.',
    ),
    placeholder: t('Ask about my platform work…', 'Pergunte sobre meu trabalho com plataformas…'),
    helper: t('Answers grounded in my record', 'Respostas baseadas no meu histórico'),
    evidence: { roles: ['acme', 'globex'], metrics: ['acme-build-time', 'globex-team'] },
  },
  assistant: { name: t("Ada's assistant", 'Assistente da Ada'), initials: 'AR' },
  contact: {
    email: 'ada@rivera.example',
    linkedin: 'https://www.linkedin.com/in/ada-rivera-example',
    github: 'https://github.com/ada-rivera-example',
    resumeUrl: '/ada-rivera-cv.pdf',
  },
  principles: [
    {
      title: t('Paved roads', 'Caminhos pavimentados'),
      text: t('Make the right way the easy way.', 'Fazer do jeito certo o jeito fácil.'),
      source: 'principles',
    },
  ],
  metrics: {
    'acme-build-time': {
      value: '40%',
      label: t('Faster builds', 'Builds mais rápidos'),
      context: 'Acme',
      source: 'cv.acme',
    },
    'globex-deploys': {
      value: '3×',
      label: t('More deploys a day', 'Mais deploys por dia'),
      context: 'Globex',
      source: 'cv.globex',
    },
    'globex-team': {
      value: '2 → 6',
      label: t('Platform team grown', 'Time de plataforma ampliado'),
      context: 'Globex',
      source: 'cv.globex',
    },
  },
  experience: [
    {
      id: 'acme',
      company: 'Acme',
      aliases: ['Acme Corp'],
      role: 'Principal Platform Engineer',
      start: '2022',
      end: null,
      current: true,
      engagement: 'employment',
      summary: t(
        'Leads the internal developer platform.',
        'Lidera a plataforma interna para desenvolvedores.',
      ),
      responsibilities: [t('Runs the build platform.', 'Opera a plataforma de build.')],
      leadership: [
        t('Leads a platform team of five.', 'Lidera um time de plataforma de cinco pessoas.'),
      ],
      achievements: [],
      focus: [t('Build systems', 'Sistemas de build')],
      metrics: ['acme-build-time'],
      highlights: [
        t(
          'Cut build times by 40% with remote caching.',
          'Reduziu o tempo de build em 40% com cache remoto.',
        ),
      ],
      source: 'cv.acme',
      reference: { encyclopediaTitle: 'Acme Corporation' },
    },
    {
      id: 'globex',
      company: 'Globex',
      role: 'Senior Platform Engineer',
      start: '2018',
      end: '2022',
      current: false,
      engagement: 'employment',
      summary: t('Built the deployment pipeline.', 'Construiu o pipeline de deploy.'),
      responsibilities: [t('Owned continuous delivery.', 'Foi responsável pela entrega contínua.')],
      leadership: [],
      achievements: [t('Tripled daily deploys.', 'Triplicou os deploys diários.')],
      focus: [t('Continuous delivery', 'Entrega contínua')],
      metrics: ['globex-deploys', 'globex-team'],
      highlights: [
        t(
          'Tripled daily deploys with a new pipeline.',
          'Triplicou os deploys diários com um novo pipeline.',
        ),
      ],
      source: 'cv.globex',
    },
    {
      id: 'initech',
      company: 'Initech',
      role: 'Build Consultant',
      start: '2017',
      end: '2019',
      current: false,
      engagement: 'contract',
      summary: t('Advised on build tooling.', 'Prestou consultoria sobre ferramentas de build.'),
      responsibilities: [t('Audited build scripts.', 'Auditou scripts de build.')],
      leadership: [],
      achievements: [],
      focus: [t('Build tooling', 'Ferramentas de build')],
      metrics: [],
      highlights: [
        t(
          'Audited and simplified the build scripts.',
          'Auditou e simplificou os scripts de build.',
        ),
      ],
      source: 'cv.initech',
    },
  ],
  skills: [
    {
      id: 'platform',
      title: t('Platform', 'Plataforma'),
      items: [t('Bazel', 'Bazel'), t('Kubernetes', 'Kubernetes')],
      source: 'cv.skills',
    },
    {
      id: 'languages',
      title: t('Languages', 'Linguagens'),
      items: [t('Go', 'Go'), t('Rust', 'Rust')],
      source: 'cv.skills',
    },
  ],
  certifications: [
    { name: 'Certified Platform Engineer', issuer: 'Platform Guild', source: 'cv.courses' },
    { name: 'Terraform Basics', issuer: 'Cloud Academy', source: 'cv.courses' },
  ],
  projects: [
    {
      id: 'pipewright',
      name: 'Pipewright',
      category: t('Developer tooling', 'Ferramentas para desenvolvedores'),
      status: t('Public beta', 'Beta público'),
      live: true,
      description: t(
        'A small CI runner for monorepos.',
        'Um pequeno executor de CI para monorepos.',
      ),
      scopeLabel: t('Key features', 'Principais funcionalidades'),
      scope: [t('Affected-target builds', 'Builds só dos alvos afetados')],
      platforms: [t('Web', 'Web')],
      technologies: [],
      considerations: [],
      outcomes: [
        t(
          'Builds its own monorepo in under a minute.',
          'Faz o build do próprio monorepo em menos de um minuto.',
        ),
      ],
      links: [
        {
          label: t('Visit pipewright.example', 'Visite pipewright.example'),
          url: 'https://pipewright.example',
        },
      ],
      source: 'projects',
    },
    {
      id: 'loomstack',
      name: 'Loomstack',
      category: t('Infrastructure', 'Infraestrutura'),
      status: t('Concept', 'Conceito'),
      live: false,
      description: t('A planned service catalogue.', 'Um catálogo de serviços planejado.'),
      scopeLabel: t('Planned scope', 'Escopo planejado'),
      scope: [t('Service ownership', 'Responsabilidade por serviço')],
      platforms: [],
      technologies: [],
      considerations: [],
      outcomes: [],
      links: [],
      source: 'projects',
    },
  ],
  education: {
    degree: t('MSc in Distributed Systems', 'Mestrado em Sistemas Distribuídos'),
    school: 'Universidade do Porto',
    schoolShort: 'UP',
    location: t('Porto, Portugal', 'Porto, Portugal'),
    year: 2012,
    source: 'cv.education',
  },
  languages: [
    { name: t('Portuguese', 'Português'), level: 'Native', source: 'cv.languages' },
    { name: t('English', 'Inglês'), level: 'Fluent', source: 'cv.languages' },
  ],
  practice: {
    designProcess: [
      t('Start from the developer journey.', 'Começar pela jornada de quem desenvolve.'),
    ],
    decisionCriteria: [t('Build or buy', 'Construir ou comprar')],
    workflow: [t('Measure the bottleneck first.', 'Medir o gargalo primeiro.')],
    caseStudies: {
      acme: {
        problem: t('Slow builds.', 'Builds lentos.'),
        angles: [t('Remote caching.', 'Cache remoto.')],
      },
    },
    skillDepth: [{ area: t('Strong', 'Sólido'), items: t('Build systems', 'Sistemas de build') }],
    toolset: [{ area: t('Build', 'Build'), items: t('Bazel, Pipewright', 'Bazel, Pipewright') }],
    fullStack: {
      summary: t('Platform first.', 'Plataforma em primeiro lugar.'),
      byCompany: [t('**Acme** — build platform.', '**Acme** — plataforma de build.')],
      ownProducts: t('Small tools for monorepos.', 'Pequenas ferramentas para monorepos.'),
    },
    aiEngineering: {
      summary: t('Uses AI to triage build failures.', 'Usa IA para triar falhas de build.'),
      tools: [t('**Assistant** — log triage.', '**Assistente** — triagem de logs.')],
      practices: [
        t(
          '**Verification** — every fix is reviewed.',
          '**Verificação** — toda correção é revisada.',
        ),
      ],
      inProducts: t('Classifies flaky tests.', 'Classifica testes instáveis.'),
    },
    leadershipPractice: {
      style: t('Leads by paving roads.', 'Lidera pavimentando caminhos.'),
      balance: t('Half coding, half leading.', 'Metade programando, metade liderando.'),
      habits: [t('Writes design notes.', 'Escreve notas de design.')],
    },
    studies: [
      t('**Build systems** — hermetic builds.', '**Sistemas de build** — builds herméticos.'),
    ],
    learningStyle: t('Learns by building tools.', 'Aprende construindo ferramentas.'),
    productDepth: {
      pipewright: t(
        'Incremental builds over a dependency graph.',
        'Builds incrementais sobre um grafo de dependências.',
      ),
      loomstack: t(
        'Ownership metadata for services.',
        'Metadados de responsabilidade por serviço.',
      ),
    },
    goals: {
      roles: t('Platform leadership.', 'Liderança de plataforma.'),
      mode: t('Remote.', 'Remoto.'),
      challenges: t('Large monorepos.', 'Monorepos grandes.'),
    },
    interests: [t('**Climbing** — bouldering.', '**Escalada** — boulder.')],
    careerArc: [t('**2012 — 2018** — infrastructure.', '**2012 — 2018** — infraestrutura.')],
    frontendArchitecture: [
      t('Thin clients over platform APIs.', 'Clientes leves sobre APIs de plataforma.'),
    ],
    performanceApproach: [t('Profile before optimizing.', 'Medir antes de otimizar.')],
    qualityPractices: [t('Hermetic tests.', 'Testes herméticos.')],
    mobileExplorations: t('No mobile work.', 'Nenhum trabalho com mobile.'),
  },
  sourceLabels: {
    cv: t('CV', 'Currículo'),
    'cv.acme': t('CV', 'Currículo'),
    'cv.globex': t('CV', 'Currículo'),
    'cv.initech': t('CV', 'Currículo'),
    'cv.education': t('CV', 'Currículo'),
    'cv.skills': t('CV', 'Currículo'),
    'cv.courses': t('CV', 'Currículo'),
    'cv.languages': t('CV', 'Currículo'),
    projects: t('Product sites', 'Sites dos produtos'),
    principles: t('Principles', 'Princípios'),
    notes: t('Notes', 'Anotações'),
  },
  notes: {
    source: 'notes',
    guide: 'Passages marked [ADA] are her own account, not verified fact.',
    passages: [
      { id: '1', text: 'Notes — Platform:\nAda reports she migrated three monorepos to Bazel.' },
      { id: '2', text: 'Notes — Studies:\nAda studies Nix for reproducible builds.' },
      { id: '3', text: 'Notes — Tooling:\nAda reports she runs the CI agents on Docker.' },
    ],
  },
  productSites: [
    {
      id: 'site/pipewright/0',
      subject: { kind: 'project', id: 'pipewright' },
      url: 'https://pipewright.example/',
      fetchedAt: '2026-10-01',
      language: 'en',
      text: 'Pipewright rebuilds only the targets a change affects. It is written in Go and caches every step remotely, so a monorepo build finishes in seconds.',
    },
    {
      id: 'site/acme/0',
      subject: { kind: 'company', id: 'acme' },
      url: 'https://www.acme.example/about',
      fetchedAt: '2026-10-01',
      language: 'en',
      text: 'Acme makes anvils for the whole desert, shipped overnight by rocket.',
    },
  ],
  references: {
    technologies: {
      Bazel: 'Bazel (software)',
      Go: 'Go (programming language)',
      Terraform: 'Terraform (software)',
      Nix: null,
    },
  },
};
