import type { ProjectSource } from '@/core/knowledge/schema';

// Marcio's own products. Descriptions and status come from each product's
// public site (Oct 2026): no users, revenue or release dates may be inferred
// beyond what those sites state. This portfolio is described by its own
// repository: its stack and outcomes are what the code and its CI show.
export const projects: readonly ProjectSource[] = [
  {
    id: 'evcopilot',
    name: 'EvCopilot',
    category: { en: 'Electric mobility · Brazil', 'pt-BR': 'Mobilidade elétrica · Brasil' },
    status: { en: 'iPhone beta · invite only', 'pt-BR': 'Beta para iPhone · só com convite' },
    live: true,
    description: {
      en: 'A trip-planning app for electric-vehicle drivers in Brazil: compatible chargers, predicted battery at every stop and a backup charger for each one.',
      'pt-BR':
        'Um app de planejamento de viagens para motoristas de veículos elétricos no Brasil: carregadores compatíveis, bateria prevista em cada parada e um carregador reserva para cada uma.',
    },
    scopeLabel: { en: 'Key features', 'pt-BR': 'Principais funcionalidades' },
    scope: [
      {
        en: 'Chargers filtered by connector and power',
        'pt-BR': 'Carregadores filtrados por conector e potência',
      },
      { en: 'Battery prediction per stop', 'pt-BR': 'Previsão de bateria por parada' },
      { en: 'Backup charger for every stop', 'pt-BR': 'Carregador reserva para cada parada' },
      { en: 'Offline itinerary', 'pt-BR': 'Roteiro offline' },
      {
        en: 'Handoff to Apple Maps, Google Maps or Waze',
        'pt-BR': 'Navegação continuada no Apple Maps, Google Maps ou Waze',
      },
      {
        en: 'Station status with source and date',
        'pt-BR': 'Status das estações com fonte e data',
      },
    ],
    platforms: [{ en: 'iPhone (beta)', 'pt-BR': 'iPhone (beta)' }],
    technologies: [],
    considerations: [],
    outcomes: [],
    links: [
      {
        label: { en: 'Visit evcopilotapp.io', 'pt-BR': 'Acesse evcopilotapp.io' },
        url: 'https://evcopilotapp.io',
      },
    ],
    source: 'projects',
  },
  {
    id: 'formdaily',
    name: 'FormDaily',
    category: { en: 'Fitness & coaching', 'pt-BR': 'Fitness e treinamento' },
    status: { en: 'Invite-only access', 'pt-BR': 'Acesso só com convite' },
    live: true,
    description: {
      en: 'A workout app for personal trainers and their students: trainers build workouts, run sessions and track progress; students follow their plan and log every set.',
      'pt-BR':
        'Um app de treinos para personal trainers e seus alunos: os treinadores montam treinos, conduzem sessões e acompanham a evolução; os alunos seguem o plano e registram cada série.',
    },
    scopeLabel: { en: 'Key features', 'pt-BR': 'Principais funcionalidades' },
    scope: [
      {
        en: 'Workout builder with loads, rest and videos',
        'pt-BR': 'Montagem de treinos com cargas, descanso e vídeos',
      },
      {
        en: 'Scheduling with Google Meet for online sessions',
        'pt-BR': 'Agendamento com Google Meet para sessões online',
      },
      {
        en: 'Live session tracking, even offline',
        'pt-BR': 'Acompanhamento da sessão ao vivo, mesmo offline',
      },
      {
        en: 'AI workout suggestions reviewed by the trainer',
        'pt-BR': 'Sugestões de treino por IA revisadas pelo treinador',
      },
      { en: 'Student progress charts', 'pt-BR': 'Gráficos da evolução dos alunos' },
      { en: 'Verified trainer badge', 'pt-BR': 'Selo de treinador verificado' },
    ],
    platforms: [
      { en: 'Web', 'pt-BR': 'Web' },
      { en: 'iOS', 'pt-BR': 'iOS' },
      { en: 'Android', 'pt-BR': 'Android' },
    ],
    technologies: [],
    considerations: [],
    outcomes: [],
    links: [
      {
        label: { en: 'Visit formdaily.app', 'pt-BR': 'Acesse formdaily.app' },
        url: 'https://formdaily.app',
      },
    ],
    source: 'projects',
  },
  {
    id: 'targup',
    name: 'TargUp',
    category: { en: 'Business automation', 'pt-BR': 'Automação de negócios' },
    status: { en: 'In development · live preview', 'pt-BR': 'Em desenvolvimento · prévia no ar' },
    live: true,
    description: {
      en: 'A business automation platform that replaces repetitive manual work with connected workflows, AI-assisted automation and operational visibility.',
      'pt-BR':
        'Uma plataforma de automação de negócios que substitui trabalho manual repetitivo por fluxos conectados, automação assistida por IA e visibilidade da operação.',
    },
    scopeLabel: { en: 'Key features', 'pt-BR': 'Principais funcionalidades' },
    scope: [
      { en: 'Workflow automation', 'pt-BR': 'Automação de fluxos de trabalho' },
      {
        en: 'AI that classifies, drafts and recommends within business rules',
        'pt-BR': 'IA que classifica, redige e recomenda dentro das regras do negócio',
      },
      { en: 'Integrations and analytics', 'pt-BR': 'Integrações e análises' },
      {
        en: 'Role-based permissions and human approval',
        'pt-BR': 'Permissões por papel e aprovação humana',
      },
      { en: 'WhatsApp appointment booking', 'pt-BR': 'Agendamento pelo WhatsApp' },
      { en: 'Chat, Social and Affiliate products', 'pt-BR': 'Produtos Chat, Social e Affiliate' },
    ],
    platforms: [{ en: 'Web', 'pt-BR': 'Web' }],
    technologies: [],
    considerations: [],
    outcomes: [],
    links: [
      { label: { en: 'Visit TargUp', 'pt-BR': 'Acesse o TargUp' }, url: 'https://dev.targup.com/' },
    ],
    source: 'projects',
  },
  {
    id: 'marciomariani-dev',
    name: 'marciomariani.dev',
    category: { en: 'AI assistant · this site', 'pt-BR': 'Assistente de IA · este site' },
    status: { en: 'Live', 'pt-BR': 'No ar' },
    live: true,
    description: {
      en: 'This portfolio: an AI assistant that answers questions about his work from his résumé and his own notes, citing its sources for every answer drawn from his record.',
      'pt-BR':
        'Este portfólio: um assistente de IA que responde perguntas sobre o trabalho dele com base no currículo e nas anotações dele, citando as fontes de cada resposta tirada do histórico dele.',
    },
    scopeLabel: { en: 'Key features', 'pt-BR': 'Principais funcionalidades' },
    scope: [
      {
        en: 'Instant answers to the questions it recognizes',
        'pt-BR': 'Respostas instantâneas às perguntas que reconhece',
      },
      {
        en: 'An OpenAI model for everything else',
        'pt-BR': 'Um modelo da OpenAI para todo o resto',
      },
      {
        en: 'A closed list of validated tools',
        'pt-BR': 'Uma lista fechada de ferramentas validadas',
      },
      {
        en: 'Retrieval over embeddings of his record',
        'pt-BR': 'Busca por embeddings sobre o histórico dele',
      },
      {
        en: 'Sources cited with each answer from his record',
        'pt-BR': 'Fontes citadas em cada resposta tirada do histórico dele',
      },
      { en: 'Usage and cost limits', 'pt-BR': 'Limites de uso e de custo' },
    ],
    platforms: [{ en: 'Web', 'pt-BR': 'Web' }],
    technologies: [
      'Next.js',
      'React',
      'TypeScript',
      'Tailwind CSS',
      'OpenAI',
      'Vitest',
      'Playwright',
    ],
    technologiesSource: 'projects',
    considerations: [],
    outcomes: [
      {
        en: 'Every pull request must pass Lighthouse CI on the home page: 100 for accessibility and SEO, at least 90 for performance.',
        'pt-BR':
          'Todo pull request precisa passar no Lighthouse CI da página inicial: 100 em acessibilidade e SEO, pelo menos 90 em performance.',
      },
      {
        en: 'Its architecture is enforced in CI: dependency rules reject any import that crosses a layer the wrong way, and the core and its adapters carry coverage thresholds.',
        'pt-BR':
          'A arquitetura é garantida no CI: regras de dependência rejeitam qualquer import que atravesse uma camada no sentido errado, e o núcleo e seus adaptadores têm limites mínimos de cobertura.',
      },
    ],
    links: [
      {
        label: { en: 'Visit marciomariani.dev', 'pt-BR': 'Acesse marciomariani.dev' },
        url: 'https://marciomariani.dev',
      },
      {
        label: { en: 'View the code on GitHub', 'pt-BR': 'Veja o código no GitHub' },
        url: 'https://github.com/marcio-w-alves/marcio-alves-portfolio',
      },
    ],
    source: 'projects',
  },
  {
    id: 'fictiondraft',
    name: 'FictionDraft',
    category: { en: 'AI writing & publishing', 'pt-BR': 'Escrita e publicação com IA' },
    status: { en: 'Concept', 'pt-BR': 'Conceito' },
    live: false,
    description: {
      en: 'An AI writing assistant for novels, books, documents and scripts: a template for each kind of text, with an AI that checks it against what was already written.',
      'pt-BR':
        'Um assistente de escrita com IA para romances, livros, documentos e roteiros: um modelo para cada tipo de texto, com uma IA que o confere contra o que já foi escrito.',
    },
    scopeLabel: { en: 'Planned scope', 'pt-BR': 'Escopo planejado' },
    scope: [
      { en: 'Editing', 'pt-BR': 'Edição' },
      { en: 'Review', 'pt-BR': 'Revisão' },
      { en: 'Translation', 'pt-BR': 'Tradução' },
      { en: 'Document consistency', 'pt-BR': 'Consistência de documentos' },
    ],
    platforms: [],
    technologies: [],
    considerations: [],
    outcomes: [],
    links: [],
    source: 'projects',
  },
];
