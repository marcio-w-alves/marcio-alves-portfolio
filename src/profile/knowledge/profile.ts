import type {
  AssistantIdentitySource,
  Contact,
  PrincipleSource,
  ProfileSource,
  WelcomeSource,
} from '@/core/knowledge/schema';
import { identity } from '../identity';

export const profile: ProfileSource = {
  name: identity.name,
  firstName: identity.firstName,
  initials: identity.initials,
  title: {
    en: 'Senior Frontend Engineer',
    'pt-BR': 'Senior Frontend Engineer',
  },
  yearsLabel: { en: '10+ years', 'pt-BR': '10+ anos' },
  careerStartYear: 2015,
  specializations: [
    { en: 'React.js', 'pt-BR': 'React.js' },
    { en: 'TypeScript', 'pt-BR': 'TypeScript' },
    { en: 'Next.js', 'pt-BR': 'Next.js' },
    { en: 'Frontend Architecture', 'pt-BR': 'Arquitetura frontend' },
    { en: 'Performance Optimization', 'pt-BR': 'Otimização de performance' },
    { en: 'Scalable Web Applications', 'pt-BR': 'Aplicações web escaláveis' },
    { en: 'Developer Experience', 'pt-BR': 'Developer Experience' },
    { en: 'Technical Leadership', 'pt-BR': 'Liderança técnica' },
    { en: 'Design Systems', 'pt-BR': 'Design systems' },
    { en: 'Product Engineering', 'pt-BR': 'Engenharia de produto' },
  ],
  summary: {
    en: 'Marcio is a senior frontend engineer with deep expertise in React and Next.js, focused on scalable architecture, performance optimization and developer experience.',
    'pt-BR':
      'Marcio é um engenheiro frontend sênior com profundo conhecimento de React e Next.js, com foco em arquitetura escalável, otimização de performance e developer experience.',
  },
  context: {
    en: 'He designs, implements and maintains scalable applications end to end, while driving technical strategy, mentoring engineers and collaborating with product and design teams.',
    'pt-BR':
      'Ele projeta, implementa e mantém aplicações escaláveis de ponta a ponta, enquanto conduz a estratégia técnica, faz mentoria de engenheiros e colabora com os times de produto e design.',
  },
  focus: {
    en: 'He plans OKRs, quarterly goals and engineering deliverables aligned with product needs and user impact, raising engineering standards and improving team execution across complex frontend systems.',
    'pt-BR':
      'Ele planeja OKRs, metas trimestrais e entregas de engenharia alinhadas às necessidades do produto e ao impacto para os usuários, elevando os padrões de engenharia e melhorando a execução do time em sistemas frontend complexos.',
  },
  location: { country: { en: 'Brazil', 'pt-BR': 'Brasil' }, city: 'João Pessoa, Paraíba' },
  availability: {
    en: 'Brazil · remote · UTC−3 · open to opportunities',
    'pt-BR': 'Brasil · remoto · UTC−3 · aberto a oportunidades',
  },
  photoUrl: '/marcio-alves.jpg',
  source: 'profile',
};

// The landing screen speaks as Marcio, in the first person. The assistant
// always speaks about him in the third person.
export const welcome: WelcomeSource = {
  heading: { en: "Hi, I'm Marcio", 'pt-BR': 'Olá, eu sou o Marcio' },
  description: {
    en: 'Senior frontend engineer with 10+ years in React, TypeScript and frontend architecture. Ask anything about my work.',
    'pt-BR':
      'Engenheiro frontend sênior com 10+ anos de React, TypeScript e arquitetura frontend. Pergunte o que quiser sobre o meu trabalho.',
  },
  placeholder: {
    en: 'Ask about my experience, skills or projects…',
    'pt-BR': 'Pergunte sobre minha experiência, competências ou projetos…',
  },
  helper: {
    en: 'AI answers grounded in my professional experience',
    'pt-BR': 'Respostas de IA baseadas na minha experiência profissional',
  },
  evidence: {
    roles: ['way2b1', 'deel', 'roots'],
    metrics: ['deel-critical-load', 'deel-web-vitals'],
  },
};

export const assistant: AssistantIdentitySource = {
  name: { en: `${identity.firstName}'s assistant`, 'pt-BR': `Assistente de ${identity.firstName}` },
  initials: identity.initials,
};

export const contact: Contact = {
  ...identity.contact,
  resumeUrl: '/marcio-alves-resume.pdf',
};

export const principles: readonly PrincipleSource[] = [
  {
    title: {
      en: 'Maintainability over cleverness',
      'pt-BR': 'Manutenibilidade acima de esperteza',
    },
    text: {
      en: 'Readable, explicit and predictable code, with long-term code health ahead of short-term convenience.',
      'pt-BR':
        'Código legível, explícito e previsível, com a saúde do código no longo prazo à frente da conveniência imediata.',
    },
    source: 'principles',
  },
  {
    title: { en: 'Composition over monoliths', 'pt-BR': 'Composição em vez de monólitos' },
    text: {
      en: 'Small primitives composed into higher-level components, with presentation kept apart from state, domain logic and side effects.',
      'pt-BR':
        'Primitivos pequenos compostos em componentes de nível mais alto, com a apresentação separada do estado, da lógica de domínio e dos efeitos colaterais.',
    },
    source: 'principles',
  },
  {
    title: { en: 'Reuse before rewriting', 'pt-BR': 'Reaproveitar antes de reescrever' },
    text: {
      en: 'Shared logic such as validators, formatters and domain helpers is centralized instead of duplicated across features.',
      'pt-BR':
        'Lógica compartilhada, como validadores, formatadores e helpers de domínio, fica centralizada em vez de duplicada entre funcionalidades.',
    },
    source: 'principles',
  },
  {
    title: {
      en: 'Architecture sized to the problem',
      'pt-BR': 'Arquitetura do tamanho do problema',
    },
    text: {
      en: "Growth, integration and maintenance are planned for, but each decision is calibrated to the product's real stage: explicit contracts, clear responsibilities, predictable state and low coupling.",
      'pt-BR':
        'Crescimento, integração e manutenção entram no planejamento, mas cada decisão é calibrada para o estágio real do produto: contratos explícitos, responsabilidades claras, estado previsível e baixo acoplamento.',
    },
    source: 'principles',
  },
  {
    title: { en: 'Performance from the design', 'pt-BR': 'Performance desde o design' },
    text: {
      en: 'Loading, rendering, data flow and the experience of use are quality criteria from the start, not late optimization work.',
      'pt-BR':
        'Carregamento, renderização, fluxo de dados e a experiência de uso são critérios de qualidade desde o início, não uma otimização deixada para o fim.',
    },
    source: 'principles',
  },
  {
    title: { en: 'UX and visual fidelity', 'pt-BR': 'UX e fidelidade visual' },
    text: {
      en: 'Hierarchy, responsiveness, loading, error and empty states, accessibility and complete flows — not just a match with the screenshot.',
      'pt-BR':
        'Hierarquia, responsividade, estados de carregamento, erro e vazio, acessibilidade e fluxos completos — não só a semelhança com a imagem do layout.',
    },
    source: 'principles',
  },
  {
    title: { en: 'Verifiable quality', 'pt-BR': 'Qualidade verificável' },
    text: {
      en: 'Tests proportional to risk, reviews, documentation where it is needed, observability and real validation before anything is called done.',
      'pt-BR':
        'Testes proporcionais ao risco, revisões, documentação onde ela faz falta, observabilidade e validação real antes de dar algo como pronto.',
    },
    source: 'principles',
  },
  {
    title: { en: 'Explicit trade-offs', 'pt-BR': 'Trade-offs explícitos' },
    text: {
      en: 'Alternatives, maintenance cost, dependencies, scalability, delivery speed and risk are discussed openly; no technology choice is treated as absolute.',
      'pt-BR':
        'Alternativas, custo de manutenção, dependências, escalabilidade, velocidade de entrega e risco são discutidos abertamente; nenhuma escolha de tecnologia é tratada como absoluta.',
    },
    source: 'principles',
  },
  {
    title: { en: 'Security on the server', 'pt-BR': 'Segurança no servidor' },
    text: {
      en: 'Access is never assumed from what the UI allows: authentication, authorization and input are validated server-side.',
      'pt-BR':
        'O acesso nunca é presumido a partir do que a interface permite: autenticação, autorização e entradas são validadas no servidor.',
    },
    source: 'principles',
  },
];
