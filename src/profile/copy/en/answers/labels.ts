import type { AnswerLabels } from '@/core/assistant/answer-labels';

/** The words inside the English answers' cards. */
export const labels: AnswerLabels = {
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
  links: { opensInNewTab: '(opens in a new tab)', pdfOpensInNewTab: '(PDF, opens in a new tab)' },
  contact: {
    heading: 'Interested in working together?',
    text: 'Get in touch with {firstName} to discuss engineering, architecture, and product opportunities.',
    email: 'Contact {firstName}',
    linkedin: 'View LinkedIn',
    resume: 'View resume',
    github: 'GitHub',
  },
};
