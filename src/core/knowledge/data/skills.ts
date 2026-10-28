import type { Certification, SkillGroup } from '../types';

export const skills: readonly SkillGroup[] = [
  { id: 'frontend', title: 'Frontend', items: ['React', 'TypeScript', 'Next.js', 'JavaScript'] },
  {
    id: 'architecture',
    title: 'Architecture',
    items: ['Scalable Frontend Architecture', 'State Management', 'Design Systems', 'SSR'],
  },
  {
    id: 'performance',
    title: 'Performance',
    items: ['Core Web Vitals', 'Bundle Optimization', 'Rendering Performance'],
  },
  {
    id: 'practices',
    title: 'Engineering Practices',
    items: [
      'Frontend Testing Strategies',
      'Developer Experience',
      'Responsive Design',
      'UX/UI',
      'SEO Optimization',
      'Agile Methodologies',
    ],
  },
  {
    id: 'leadership',
    title: 'Leadership',
    items: [
      'Mentorship',
      'Technical Strategy',
      'Technical Trade-Offs',
      'Code Reviews',
      'Hiring',
      'Product Collaboration',
    ],
  },
  {
    id: 'backend',
    title: 'Backend & Infrastructure',
    items: ['Node.js', 'REST APIs', 'PostgreSQL', 'Redis', 'CI/CD', 'AWS'],
  },
];

// Coursework, not professional experience: the assistant must keep the two
// apart when asked whether he has worked with one of these technologies.
export const certifications: readonly Certification[] = [
  { name: 'Angular 2 And 4 Course From Basic To Pro', issuer: 'Udemy' },
  { name: 'Android Studio - Curso Completo Crie 10 Apps', issuer: 'Udemy' },
  { name: 'Learn And Understand AngularJS', issuer: 'Udemy' },
  { name: 'The Complete React Web Developer Course (With Redux)', issuer: 'Udemy' },
  { name: 'Entendendo E Documentando REST / RESTful APIs', issuer: 'Udemy' },
];
