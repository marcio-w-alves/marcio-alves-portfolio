import type { AnswerLabels } from '@/core/assistant/answer-labels';

/** The words inside the fictional person's English answers' cards. */
export const englishLabels: AnswerLabels = {
  roleSections: {
    responsibilities: 'Responsibilities',
    impact: 'Engineering impact',
    leadership: 'Leadership',
    achievements: 'Notable achievements',
    focus: 'Focus areas',
  },
  badges: { current: 'Current', contract: 'Contract' },
  cards: {
    metrics: 'Key metrics',
    skills: 'Technical skills',
    skillsUnit: 'skills',
    timeline: 'Career timeline',
    table: 'Table',
  },
  project: {
    card: 'Project: {project}',
    platforms: 'Platforms',
    technologies: 'Main technologies',
    considerations: 'Engineering considerations',
    outcomes: 'Outcomes',
  },
  notes: { inference: 'Assessment', example: 'Illustrative example', info: 'Note' },
  contact: {
    heading: 'Interested in working together?',
    text: 'Get in touch with {firstName} about platform engineering.',
    email: 'Contact {firstName}',
    linkedin: 'View LinkedIn',
    resume: 'View resume',
    github: 'GitHub',
  },
};

/** The same words in Portuguese. */
export const portugueseLabels: AnswerLabels = {
  roleSections: {
    responsibilities: 'Responsabilidades',
    impact: 'Impacto de engenharia',
    leadership: 'Liderança',
    achievements: 'Conquistas de destaque',
    focus: 'Áreas de foco',
  },
  badges: { current: 'Atual', contract: 'Contrato' },
  cards: {
    metrics: 'Métricas principais',
    skills: 'Competências técnicas',
    skillsUnit: 'competências',
    timeline: 'Linha do tempo da carreira',
    table: 'Tabela',
  },
  project: {
    card: 'Projeto: {project}',
    platforms: 'Plataformas',
    technologies: 'Principais tecnologias',
    considerations: 'Considerações de engenharia',
    outcomes: 'Resultados',
  },
  notes: { inference: 'Avaliação', example: 'Exemplo ilustrativo', info: 'Observação' },
  contact: {
    heading: 'Vamos trabalhar juntas?',
    text: 'Fale com {firstName} sobre engenharia de plataforma.',
    email: 'Falar com {firstName}',
    linkedin: 'Ver LinkedIn',
    resume: 'Ver currículo',
    github: 'GitHub',
  },
};
