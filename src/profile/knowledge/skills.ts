import type { CertificationSource, SkillGroupSource } from '@/core/knowledge/schema';

export const skills: readonly SkillGroupSource[] = [
  {
    id: 'frontend',
    title: { en: 'Frontend', 'pt-BR': 'Frontend' },
    items: [
      { en: 'React', 'pt-BR': 'React' },
      { en: 'TypeScript', 'pt-BR': 'TypeScript' },
      { en: 'Next.js', 'pt-BR': 'Next.js' },
      { en: 'JavaScript', 'pt-BR': 'JavaScript' },
      { en: 'Responsive Design', 'pt-BR': 'Design responsivo' },
    ],
    source: 'resume.skills',
  },
  {
    id: 'architecture',
    title: { en: 'Architecture', 'pt-BR': 'Arquitetura' },
    items: [
      { en: 'Scalable Frontend Architecture', 'pt-BR': 'Arquitetura frontend escalável' },
      { en: 'State Management', 'pt-BR': 'Gerenciamento de estado' },
      { en: 'Server-Side Rendering', 'pt-BR': 'Server-Side Rendering' },
      { en: 'Developer Experience', 'pt-BR': 'Developer Experience' },
    ],
    source: 'resume.skills',
  },
  {
    id: 'performance',
    title: { en: 'Performance & Quality', 'pt-BR': 'Performance e qualidade' },
    items: [
      { en: 'Core Web Vitals', 'pt-BR': 'Core Web Vitals' },
      { en: 'SEO', 'pt-BR': 'SEO' },
      { en: 'Accessibility', 'pt-BR': 'Acessibilidade' },
      { en: 'Frontend Testing Strategies', 'pt-BR': 'Estratégias de teste de frontend' },
    ],
    source: 'resume.skills',
  },
  {
    id: 'leadership',
    title: { en: 'Leadership', 'pt-BR': 'Liderança' },
    items: [
      { en: 'Technical Strategy', 'pt-BR': 'Estratégia técnica' },
      { en: 'Technical Trade-offs', 'pt-BR': 'Trade-offs técnicos' },
      { en: 'Mentoring', 'pt-BR': 'Mentoria' },
      { en: 'Code Reviews', 'pt-BR': 'Revisões de código' },
      { en: 'Hiring', 'pt-BR': 'Contratação' },
      { en: 'OKR Planning', 'pt-BR': 'Planejamento de OKRs' },
      { en: 'Agile', 'pt-BR': 'Ágil' },
    ],
    source: 'resume.skills',
  },
  {
    id: 'backend',
    title: { en: 'Backend & Infrastructure', 'pt-BR': 'Backend e infraestrutura' },
    items: [
      { en: 'Node.js', 'pt-BR': 'Node.js' },
      { en: 'REST APIs', 'pt-BR': 'APIs REST' },
      { en: 'Microservices', 'pt-BR': 'Microsserviços' },
      { en: 'PostgreSQL', 'pt-BR': 'PostgreSQL' },
      { en: 'Redis', 'pt-BR': 'Redis' },
      { en: 'CI/CD', 'pt-BR': 'CI/CD' },
      { en: 'AWS', 'pt-BR': 'AWS' },
    ],
    source: 'resume.skills',
  },
];

// Coursework, not professional experience: the assistant must keep the two
// apart when asked whether he has worked with one of these technologies.
export const certifications: readonly CertificationSource[] = [
  {
    name: 'The Complete React Web Developer Course (with Redux)',
    issuer: 'Udemy',
    source: 'resume.certifications',
  },
  {
    name: 'Angular 2 and 4 Course: From Basic to Pro',
    issuer: 'Udemy',
    source: 'resume.certifications',
  },
  { name: 'Learn and Understand AngularJS', issuer: 'Udemy', source: 'resume.certifications' },
  {
    name: 'Android Studio — Curso Completo: Crie 10 Apps',
    issuer: 'Udemy',
    source: 'resume.certifications',
  },
  {
    name: 'Entendendo e Documentando REST / RESTful APIs',
    issuer: 'Udemy',
    source: 'resume.certifications',
  },
];
