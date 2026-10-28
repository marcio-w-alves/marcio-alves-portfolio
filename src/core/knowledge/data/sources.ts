import type { SourceId } from '../ids';

// Every section of the résumé is cited as the résumé itself: a visitor needs
// to know where an answer comes from, not which part of the document.
export const sourceLabels: Readonly<Record<SourceId, string>> = {
  profile: 'Resume',
  principles: 'Engineering principles',
  'resume.toptal': 'Resume',
  'resume.deel': 'Resume',
  'resume.roots': 'Resume',
  'resume.maison': 'Resume',
  'resume.shall': 'Resume',
  'resume.webfi': 'Resume',
  'resume.freelance': 'Resume',
  'resume.skills': 'Resume',
  'resume.education': 'Resume',
  'resume.languages': 'Resume',
  'resume.certifications': 'Resume',
  projects: 'Product websites and notes',
  notes: 'Knowledge base',
};
