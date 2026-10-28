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
  context: 'Marcio has experience working across startups and large, complex software products.',
  focus:
    'He focuses on building maintainable applications, making sound architectural decisions, raising engineering standards and aligning technical work with product needs and user impact.',
  location: { country: 'Brazil', city: null },
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
    title: 'Security on the server',
    text: 'Access is never assumed from what the UI allows: authentication, authorization and input are validated server-side.',
  },
];
