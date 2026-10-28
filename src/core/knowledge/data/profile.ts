import type { Contact, Principle, Profile, Welcome } from '../types';

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
    'Staff Frontend Engineer with deep expertise in React.js and Next.js, focused on scalable architecture, performance optimization, and developer experience. Experienced in designing, implementing, and maintaining scalable applications end-to-end, while driving technical strategy, mentoring engineers, and collaborating cross-functionally with product and design teams. Strong background in planning OKRs, quarterly goals, and engineering deliverables aligned with product needs and user impact.',
  context: 'Marcio has experience working across startups and large, complex software products.',
  focus:
    'He focuses on building maintainable applications, making sound architectural decisions, improving engineering processes, and aligning technical work with product impact.',
  location: { country: 'Brazil', city: null },
  source: 'profile',
};

// The landing screen speaks as Marcio, in the first person. The assistant
// always speaks about him in the third person.
export const welcome: Welcome = {
  eyebrow: 'Welcome to my portfolio',
  heading: "Hi, I'm Marcio",
  subheading: 'Frontend engineer, architect, and problem solver',
  description:
    "I've spent over a decade building scalable web applications, improving performance, and helping engineering teams deliver better products.",
  invitation:
    'Explore my experience, dive into technical decisions, or ask my AI assistant anything about my work.',
  placeholder: 'Ask anything about my experience, skills, or projects...',
  helper: 'Powered by AI · Grounded in my professional experience',
};

export const contact: Contact = {
  email: 'marcio.welben@gmail.com',
  linkedin: 'https://www.linkedin.com/in/marcio-montenegro',
  github: 'https://github.com/marcio-w-alves',
  resumeUrl: null,
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
