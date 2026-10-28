import type { AssistantIdentity, Contact, Principle, Profile, Welcome } from '../types';

export const profile: Profile = {
  name: 'Marcio Alves',
  firstName: 'Marcio',
  initials: 'MA',
  title: 'Staff-level Frontend Engineer',
  yearsLabel: '10+ years',
  careerStartYear: 2015,
  specializations: [
    'React.js',
    'TypeScript',
    'Next.js',
    'Frontend Architecture',
    'Performance Optimization',
    'Scalable Web Applications',
    'Developer Experience',
    'Technical Leadership',
    'Design Systems',
    'Product Engineering',
  ],
  summary:
    'Marcio is a Staff-level frontend engineer with deep expertise in React and Next.js, focused on scalable architecture, performance optimization and developer experience.',
  context:
    'He designs, implements and maintains scalable applications end to end, while driving technical strategy, mentoring engineers and collaborating with product and design teams.',
  focus:
    'He plans OKRs, quarterly goals and engineering deliverables aligned with product needs and user impact, raising engineering standards and improving team execution across complex frontend systems.',
  location: { country: 'Brazil', city: 'João Pessoa, Paraíba' },
  source: 'profile',
};

// The landing screen speaks as Marcio, in the first person. The assistant
// always speaks about him in the third person.
export const welcome: Welcome = {
  heading: "Hi, I'm Marcio",
  description:
    'Staff-level frontend engineer with 10+ years in React, TypeScript and frontend architecture. Ask anything about my work.',
  placeholder: 'Ask about my experience, skills or projects…',
  helper: 'AI answers grounded in my professional experience',
};

export const assistant: AssistantIdentity = { name: "Marcio's assistant", initials: 'MA' };

export const contact: Contact = {
  email: 'marcio.welben@gmail.com',
  linkedin: 'https://www.linkedin.com/in/marcio-montenegro',
  github: 'https://github.com/marcio-w-alves',
  resumeUrl: '/marcio-alves-resume.pdf',
};

export const principles: readonly Principle[] = [
  {
    title: 'Maintainability over cleverness',
    text: 'Readable, explicit and predictable code, with long-term code health ahead of short-term convenience.',
  },
  {
    title: 'Composition over monoliths',
    text: 'Small primitives composed into higher-level components, with presentation kept apart from state, domain logic and side effects.',
  },
  {
    title: 'Reuse before rewriting',
    text: 'Shared logic such as validators, formatters and domain helpers is centralized instead of duplicated across features.',
  },
  {
    title: 'Architecture sized to the problem',
    text: "Growth, integration and maintenance are planned for, but each decision is calibrated to the product's real stage: explicit contracts, clear responsibilities, predictable state and low coupling.",
  },
  {
    title: 'Performance from the design',
    text: 'Loading, rendering, data flow and the experience of use are quality criteria from the start, not late optimization work.',
  },
  {
    title: 'UX and visual fidelity',
    text: 'Hierarchy, responsiveness, loading, error and empty states, accessibility and complete flows — not just a match with the screenshot.',
  },
  {
    title: 'Verifiable quality',
    text: 'Tests proportional to risk, reviews, documentation where it is needed, observability and real validation before anything is called done.',
  },
  {
    title: 'Explicit trade-offs',
    text: 'Alternatives, maintenance cost, dependencies, scalability, delivery speed and risk are discussed openly; no technology choice is treated as absolute.',
  },
  {
    title: 'Security on the server',
    text: 'Access is never assumed from what the UI allows: authentication, authorization and input are validated server-side.',
  },
];
