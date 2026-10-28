import type { Project } from '../types';

// Marcio's own products. Descriptions and status come from each product's
// public site (Oct 2026): no users, revenue or release dates may be inferred
// beyond what those sites state.
export const projects: readonly Project[] = [
  {
    id: 'evcopilot',
    name: 'EvCopilot',
    category: 'Electric mobility · Brazil',
    status: 'iPhone beta · invite only',
    live: true,
    description:
      'A trip-planning app for electric-vehicle drivers in Brazil: compatible chargers, predicted battery at every stop and a backup charger for each one.',
    scopeLabel: 'Key features',
    scope: [
      'Chargers filtered by connector and power',
      'Battery prediction per stop',
      'Backup charger for every stop',
      'Offline itinerary',
      'Handoff to Apple Maps, Google Maps or Waze',
      'Station status with source and date',
    ],
    platforms: ['iPhone (beta)'],
    technologies: [],
    considerations: [],
    links: [{ label: 'Visit evcopilotapp.io', url: 'https://evcopilotapp.io' }],
    source: 'projects',
  },
  {
    id: 'formdaily',
    name: 'FormDaily',
    category: 'Fitness & coaching',
    status: 'Invite-only access',
    live: true,
    description:
      'A workout app for personal trainers and their students: trainers build workouts, run sessions and track progress; students follow their plan and log every set.',
    scopeLabel: 'Key features',
    scope: [
      'Workout builder with loads, rest and videos',
      'Scheduling with Google Meet for online sessions',
      'Live session tracking, even offline',
      'AI workout suggestions reviewed by the trainer',
      'Student progress charts',
      'Verified trainer badge',
    ],
    platforms: ['Web', 'iOS', 'Android'],
    technologies: [],
    considerations: [],
    links: [{ label: 'Visit formdaily.app', url: 'https://formdaily.app' }],
    source: 'projects',
  },
  {
    id: 'targup',
    name: 'TargUp',
    category: 'Business automation',
    status: 'In development · live preview',
    live: true,
    description:
      'A business automation platform that replaces repetitive manual work with connected workflows, AI-assisted automation and operational visibility.',
    scopeLabel: 'Key features',
    scope: [
      'Workflow automation',
      'AI that classifies, drafts and recommends within business rules',
      'Integrations and analytics',
      'Role-based permissions and human approval',
      'WhatsApp appointment booking',
      'Chat, Social and Affiliate products',
    ],
    platforms: ['Web'],
    technologies: [],
    considerations: [],
    links: [{ label: 'Visit TargUp', url: 'https://dev.targup.com/' }],
    source: 'projects',
  },
  {
    id: 'fictiondraft',
    name: 'FictionDraft',
    category: 'AI writing & publishing',
    status: 'In development · not published',
    live: false,
    description:
      'An AI writing assistant for novels, books, documents and scripts: a template for each kind of text, with an AI that checks it against what was already written.',
    scopeLabel: 'Planned scope',
    scope: ['Editing', 'Review', 'Translation', 'Document consistency'],
    platforms: [],
    technologies: [],
    considerations: [],
    links: [],
    source: 'projects',
  },
];
