import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { metricValue } from './response-kit';

/**
 * Topics are entry points into the same conversation, not pages: choosing one
 * appends a curated introduction — never a model call — and swaps the
 * suggested questions.
 */

export const TOPIC_IDS = [
  'overview',
  'experience',
  'skills',
  'projects',
  'achievements',
  'philosophy',
  'education',
] as const;
export type TopicId = (typeof TOPIC_IDS)[number];

export type TopicIcon =
  'home' | 'briefcase' | 'code' | 'folder' | 'award' | 'compass' | 'graduation';

export interface Topic {
  readonly id: TopicId;
  readonly label: string;
  readonly icon: TopicIcon;
  readonly intro: string;
  readonly questions: readonly string[];
}

function joinNames(names: readonly string[]): string {
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

const { profile, experience, projects, languages, education } = knowledgeBase;

// A tuple, so the first topic is a known fallback rather than a possibly-undefined index.
export const topics = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'home',
    intro: `Here is the big picture: ${profile.firstName} is a Staff-level frontend engineer with ${profile.yearsLabel} of experience in React, TypeScript and frontend architecture. Ask about his career, his impact or how he works.`,
    questions: [
      "Tell me about Marcio's career.",
      'What makes Marcio a strong Staff Engineer?',
      'What has he built at Deel?',
      'How experienced is he with React and TypeScript?',
      'What are his biggest technical achievements?',
      'Has he led engineering teams?',
      'What projects is he working on?',
      'How does he approach frontend architecture?',
    ],
  },
  {
    id: 'experience',
    label: 'Experience',
    icon: 'briefcase',
    intro: `Marcio's career spans ${String(experience.length)} roles since ${String(profile.careerStartYear)}, from freelance web development to senior and lead frontend positions at Roots, Deel and Toptal. Ask about any company, or how his responsibilities grew over time.`,
    questions: [
      "Tell me about Marcio's career.",
      'What has he built at Deel?',
      'What did he do at Roots?',
      'What is he working on at Toptal?',
      'Tell me about his experience scaling frontend applications.',
      'Has he ever built something from scratch?',
      'Is he experienced with enterprise applications?',
      'Has he worked with backend systems?',
    ],
  },
  {
    id: 'skills',
    label: 'Technical Skills',
    icon: 'code',
    intro:
      "Marcio's core stack is React, TypeScript and Next.js, backed by architecture, performance and leadership skills. Ask about any area and you'll get the evidence behind it, not a self-rated score.",
    questions: [
      'How experienced is he with React and TypeScript?',
      'What are his strongest technical skills?',
      'How did he optimize performance?',
      'Has he worked with backend systems?',
      'Does he have Next.js and SSR experience?',
      'What does he know about design systems?',
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'folder',
    intro: `Besides his professional work, Marcio is developing ${String(projects.length)} independent product concepts: ${joinNames(projects.map((project) => project.name))}. Ask about any of them — I'll be clear about what's planned versus built.`,
    questions: [
      'What projects is he working on?',
      'Tell me more about EvCopilot.',
      'What is FictionDraft?',
      'Tell me more about FormDaily.',
      'What is TargUp?',
      'Has he ever built something from scratch?',
    ],
  },
  {
    id: 'achievements',
    label: 'Achievements',
    icon: 'award',
    intro: `The strongest documented results include a ${metricValue('deel-critical-load')} cut in critical page loading time and a ${metricValue('deel-backlog')} smaller bug and support backlog at Deel, plus growing the Roots engineering team from one to four developers. Ask for the context behind any of them.`,
    questions: [
      'What are his biggest technical achievements?',
      'What measurable improvements has he delivered?',
      'How did he optimize performance?',
      'How did he reduce the bug backlog at Deel?',
      'How did he grow the team at Roots?',
      'Has he received any awards?',
    ],
  },
  {
    id: 'philosophy',
    label: 'Engineering Philosophy',
    icon: 'compass',
    intro: `${profile.focus.replace(/^He/, 'Marcio')} Ask how those principles show up in his work.`,
    questions: [
      "What's his engineering philosophy?",
      'How does he approach frontend architecture?',
      'Show me examples of architectural decisions.',
      'How does he work with product teams?',
      'How does he think about code quality?',
    ],
  },
  {
    id: 'education',
    label: 'Education & Languages',
    icon: 'graduation',
    intro: `Marcio holds a ${education.degree.replace("Bachelor's Degree", "Bachelor's degree")} from ${education.school} (${String(education.year)}) and works in ${joinNames(languages.map((language) => language.name))}.`,
    questions: [
      'Where did he study?',
      'What languages does he speak?',
      'Does he speak French?',
      'Can I see his resume?',
    ],
  },
] as const satisfies readonly Topic[];

export function topicById(id: string): Topic {
  return topics.find((topic) => topic.id === id) ?? topics[0];
}

/** Rotates through a topic's pool so the screen never lists every prompt at once. */
export function suggestions(topicId: string, page: number, count: number): string[] {
  const pool = topicById(topicId).questions;
  const size = Math.min(count, pool.length);
  const start = (page * size) % pool.length;
  return Array.from({ length: size }, (_, offset) => pool[(start + offset) % pool.length] ?? '');
}
