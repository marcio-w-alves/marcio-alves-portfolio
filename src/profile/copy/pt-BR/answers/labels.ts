import type { AnswerLabels } from '@/core/assistant/answer-labels';

/** The words inside the Portuguese answers' cards. */
export const labels: AnswerLabels = {
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
  links: {
    opensInNewTab: '(abre em uma nova aba)',
    pdfOpensInNewTab: '(PDF, abre em uma nova aba)',
  },
  contact: {
    heading: 'Vamos trabalhar juntos?',
    text: 'Fale com {firstName} sobre oportunidades de engenharia, arquitetura e produto.',
    email: 'Falar com {firstName}',
    linkedin: 'Ver LinkedIn',
    resume: 'Ver currículo',
    github: 'GitHub',
  },
};
