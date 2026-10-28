import type { Certification, SkillGroup } from '../types';

export const skills: readonly SkillGroup[] = [
  {
    id: 'frontend',
    title: 'Frontend',
    items: ['React', 'TypeScript', 'Next.js', 'JavaScript', 'Responsive Design'],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    items: [
      'Scalable Frontend Architecture',
      'State Management',
      'Component Libraries',
      'Server-Side Rendering',
      'Developer Experience',
    ],
  },
  {
    id: 'performance',
    title: 'Performance & Quality',
    items: [
      'Core Web Vitals',
      'Bundle Optimization',
      'SEO',
      'Accessibility',
      'Frontend Testing Strategies',
    ],
  },
  {
    id: 'leadership',
    title: 'Leadership',
    items: [
      'Technical Strategy',
      'Technical Trade-offs',
      'Mentoring',
      'Code Reviews',
      'Hiring',
      'OKR Planning',
      'Agile',
    ],
  },
  {
    id: 'backend',
    title: 'Backend & Infrastructure',
    items: ['Node.js', 'REST APIs', 'Microservices', 'PostgreSQL', 'Redis', 'CI/CD', 'AWS'],
  },
];

// Coursework, not professional experience: the assistant must keep the two
// apart when asked whether he has worked with one of these technologies.
export const certifications: readonly Certification[] = [
  { name: 'The Complete React Web Developer Course (with Redux)', issuer: 'Udemy' },
  { name: 'Angular 2 and 4 Course: From Basic to Pro', issuer: 'Udemy' },
  { name: 'Learn and Understand AngularJS', issuer: 'Udemy' },
  { name: 'Android Studio — Curso Completo: Crie 10 Apps', issuer: 'Udemy' },
  { name: 'Entendendo e Documentando REST / RESTful APIs', issuer: 'Udemy' },
];
