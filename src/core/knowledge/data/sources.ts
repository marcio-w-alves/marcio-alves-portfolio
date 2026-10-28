import type { SourceId } from '../ids';

export const sourceLabels: Readonly<Record<SourceId, string>> = {
  profile: 'Professional profile',
  principles: 'Engineering principles',
  'resume.toptal': 'Resume · Toptal experience',
  'resume.deel': 'Resume · Deel experience',
  'resume.roots': 'Resume · Roots experience',
  'resume.maison': 'Resume · Maison Modern experience',
  'resume.shall': 'Resume · Shall And Partners experience',
  'resume.webfi': 'Resume · WEBFI experience',
  'resume.freelance': 'Resume · Freelance work',
  'resume.skills': 'Resume · Skills',
  'resume.education': 'Resume · Education',
  'resume.languages': 'Resume · Languages',
  'resume.certifications': 'Resume · Certifications',
  projects: 'Personal project notes',
};
