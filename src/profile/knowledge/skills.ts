import type { CertificationSource, SkillGroupSource } from '@/core/knowledge/schema';

export const skills: readonly SkillGroupSource[] = [
  {
    id: 'frontend',
    title: { en: 'Frontend' },
    items: [
      { en: 'React' },
      { en: 'TypeScript' },
      { en: 'Next.js' },
      { en: 'JavaScript' },
      { en: 'Responsive Design' },
    ],
  },
  {
    id: 'architecture',
    title: { en: 'Architecture' },
    items: [
      { en: 'Scalable Frontend Architecture' },
      { en: 'State Management' },
      { en: 'Component Libraries' },
      { en: 'Server-Side Rendering' },
      { en: 'Developer Experience' },
    ],
  },
  {
    id: 'performance',
    title: { en: 'Performance & Quality' },
    items: [
      { en: 'Core Web Vitals' },
      { en: 'SEO' },
      { en: 'Accessibility' },
      { en: 'Frontend Testing Strategies' },
    ],
  },
  {
    id: 'leadership',
    title: { en: 'Leadership' },
    items: [
      { en: 'Technical Strategy' },
      { en: 'Technical Trade-offs' },
      { en: 'Mentoring' },
      { en: 'Code Reviews' },
      { en: 'Hiring' },
      { en: 'OKR Planning' },
      { en: 'Agile' },
    ],
  },
  {
    id: 'backend',
    title: { en: 'Backend & Infrastructure' },
    items: [
      { en: 'Node.js' },
      { en: 'REST APIs' },
      { en: 'Microservices' },
      { en: 'PostgreSQL' },
      { en: 'Redis' },
      { en: 'CI/CD' },
      { en: 'AWS' },
    ],
  },
];

// Coursework, not professional experience: the assistant must keep the two
// apart when asked whether he has worked with one of these technologies.
export const certifications: readonly CertificationSource[] = [
  { name: 'The Complete React Web Developer Course (with Redux)', issuer: 'Udemy' },
  { name: 'Angular 2 and 4 Course: From Basic to Pro', issuer: 'Udemy' },
  { name: 'Learn and Understand AngularJS', issuer: 'Udemy' },
  { name: 'Android Studio — Curso Completo: Crie 10 Apps', issuer: 'Udemy' },
  { name: 'Entendendo e Documentando REST / RESTful APIs', issuer: 'Udemy' },
];
