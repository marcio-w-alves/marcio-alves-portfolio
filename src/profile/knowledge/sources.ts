import type { Localized } from '@/core/knowledge/schema';

// Every section of the résumé is cited as the résumé itself: a visitor needs
// to know where an answer comes from, not which part of the document.
export const sourceLabels: Readonly<Record<string, Localized>> = {
  profile: { en: 'Resume', 'pt-BR': 'Currículo' },
  principles: { en: 'Engineering principles', 'pt-BR': 'Princípios de engenharia' },
  'resume.way2b1': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.deel': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.roots': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.maison': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.shall': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.webfi': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.freelance': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.skills': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.education': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.languages': { en: 'Resume', 'pt-BR': 'Currículo' },
  'resume.certifications': { en: 'Resume', 'pt-BR': 'Currículo' },
  projects: { en: 'Product websites and notes', 'pt-BR': 'Sites dos produtos e anotações' },
  notes: { en: 'Knowledge base', 'pt-BR': 'Base de conhecimento' },
};
