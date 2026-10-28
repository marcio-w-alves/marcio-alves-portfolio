import type { Localized } from '@/core/knowledge/schema';

// Every section of the résumé is cited as the résumé itself: a visitor needs
// to know where an answer comes from, not which part of the document.
export const sourceLabels: Readonly<Record<string, Localized>> = {
  profile: { en: 'Resume' },
  principles: { en: 'Engineering principles' },
  // Not on the published résumé yet: Marcio described the role himself.
  'notes.way2b1': { en: 'Knowledge base' },
  'resume.deel': { en: 'Resume' },
  'resume.roots': { en: 'Resume' },
  'resume.maison': { en: 'Resume' },
  'resume.shall': { en: 'Resume' },
  'resume.webfi': { en: 'Resume' },
  'resume.freelance': { en: 'Resume' },
  'resume.skills': { en: 'Resume' },
  'resume.education': { en: 'Resume' },
  'resume.languages': { en: 'Resume' },
  'resume.certifications': { en: 'Resume' },
  projects: { en: 'Product websites and notes' },
  notes: { en: 'Knowledge base' },
};
