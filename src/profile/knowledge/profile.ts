import type {
  AssistantIdentitySource,
  Contact,
  PrincipleSource,
  ProfileSource,
  WelcomeSource,
} from '@/core/knowledge/schema';
import { identity } from '../identity';

export const profile: ProfileSource = {
  name: identity.name,
  firstName: identity.firstName,
  initials: identity.initials,
  title: { en: 'Staff-level Frontend Engineer' },
  yearsLabel: { en: '10+ years' },
  careerStartYear: 2015,
  specializations: [
    { en: 'React.js' },
    { en: 'TypeScript' },
    { en: 'Next.js' },
    { en: 'Frontend Architecture' },
    { en: 'Performance Optimization' },
    { en: 'Scalable Web Applications' },
    { en: 'Developer Experience' },
    { en: 'Technical Leadership' },
    { en: 'Design Systems' },
    { en: 'Product Engineering' },
  ],
  summary: {
    en: 'Marcio is a Staff-level frontend engineer with deep expertise in React and Next.js, focused on scalable architecture, performance optimization and developer experience.',
  },
  context: {
    en: 'He designs, implements and maintains scalable applications end to end, while driving technical strategy, mentoring engineers and collaborating with product and design teams.',
  },
  focus: {
    en: 'He plans OKRs, quarterly goals and engineering deliverables aligned with product needs and user impact, raising engineering standards and improving team execution across complex frontend systems.',
  },
  location: { country: { en: 'Brazil' }, city: 'João Pessoa, Paraíba' },
  source: 'profile',
};

// The landing screen speaks as Marcio, in the first person. The assistant
// always speaks about him in the third person.
export const welcome: WelcomeSource = {
  heading: { en: "Hi, I'm Marcio" },
  description: {
    en: 'Staff-level frontend engineer with 10+ years in React, TypeScript and frontend architecture. Ask anything about my work.',
  },
  placeholder: { en: 'Ask about my experience, skills or projects…' },
  helper: { en: 'AI answers grounded in my professional experience' },
};

export const assistant: AssistantIdentitySource = {
  name: { en: `${identity.firstName}'s assistant` },
  initials: identity.initials,
};

export const contact: Contact = {
  ...identity.contact,
  resumeUrl: '/marcio-alves-resume.pdf',
};

export const principles: readonly PrincipleSource[] = [
  {
    title: { en: 'Maintainability over cleverness' },
    text: {
      en: 'Readable, explicit and predictable code, with long-term code health ahead of short-term convenience.',
    },
  },
  {
    title: { en: 'Composition over monoliths' },
    text: {
      en: 'Small primitives composed into higher-level components, with presentation kept apart from state, domain logic and side effects.',
    },
  },
  {
    title: { en: 'Reuse before rewriting' },
    text: {
      en: 'Shared logic such as validators, formatters and domain helpers is centralized instead of duplicated across features.',
    },
  },
  {
    title: { en: 'Architecture sized to the problem' },
    text: {
      en: "Growth, integration and maintenance are planned for, but each decision is calibrated to the product's real stage: explicit contracts, clear responsibilities, predictable state and low coupling.",
    },
  },
  {
    title: { en: 'Performance from the design' },
    text: {
      en: 'Loading, rendering, data flow and the experience of use are quality criteria from the start, not late optimization work.',
    },
  },
  {
    title: { en: 'UX and visual fidelity' },
    text: {
      en: 'Hierarchy, responsiveness, loading, error and empty states, accessibility and complete flows — not just a match with the screenshot.',
    },
  },
  {
    title: { en: 'Verifiable quality' },
    text: {
      en: 'Tests proportional to risk, reviews, documentation where it is needed, observability and real validation before anything is called done.',
    },
  },
  {
    title: { en: 'Explicit trade-offs' },
    text: {
      en: 'Alternatives, maintenance cost, dependencies, scalability, delivery speed and risk are discussed openly; no technology choice is treated as absolute.',
    },
  },
  {
    title: { en: 'Security on the server' },
    text: {
      en: 'Access is never assumed from what the UI allows: authentication, authorization and input are validated server-side.',
    },
  },
];
