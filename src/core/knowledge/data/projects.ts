import type { Project } from '../types';

// Independent product concepts. Only planned scope is documented: no
// deployment status, users, revenue or release dates may be inferred.
export const projects: readonly Project[] = [
  {
    id: 'targup',
    name: 'TargUp',
    category: 'Affiliate marketing automation',
    status: 'Independent concept',
    description: 'An affiliate marketing automation platform concept.',
    scope: ['Campaign management', 'Messaging integrations', 'Analytics'],
    technologies: [],
    considerations: [],
    links: [],
    source: 'projects',
  },
  {
    id: 'formdaily',
    name: 'FormDaily',
    category: 'Fitness & coaching',
    status: 'Independent concept',
    description:
      'A fitness and coaching platform concept for personal trainers and their students.',
    scope: ['Workout tracking', 'Trainer and student coaching', 'AI-powered recommendations'],
    technologies: [],
    considerations: [],
    links: [],
    source: 'projects',
  },
  {
    id: 'evcopilot',
    name: 'EvCopilot',
    category: 'Electric mobility',
    status: 'Independent concept',
    description: 'An electric-vehicle companion platform concept.',
    scope: ['Charging infrastructure', 'Route planning', 'Battery and range analytics'],
    technologies: [],
    considerations: [],
    links: [],
    source: 'projects',
  },
  {
    id: 'fictiondraft',
    name: 'FictionDraft',
    category: 'AI writing & publishing',
    status: 'Independent concept',
    description: 'An AI-assisted writing and publishing platform concept.',
    scope: ['Editing', 'Review', 'Translation', 'Document consistency'],
    technologies: [],
    considerations: [],
    links: [],
    source: 'projects',
  },
];
