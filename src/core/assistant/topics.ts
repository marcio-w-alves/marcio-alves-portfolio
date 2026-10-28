import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { metricValue } from './response-kit';

/**
 * Topics are the site's pages: each opens with a curated introduction and its
 * part of the record — never a model call — and has its own conversation.
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

/** The full question is what gets asked; the tag names its subject. */
export interface TopicQuestion {
  readonly question: string;
  readonly tag: string;
  /** A shorter chip label for the welcome screen, where one is written. */
  readonly short?: string;
}

export interface Topic {
  readonly id: TopicId;
  readonly label: string;
  readonly icon: TopicIcon;
  readonly intro: string;
  readonly questions: readonly TopicQuestion[];
}

/** A question ready to show, with its tag and its chip label resolved. */
export interface SuggestedQuestion {
  readonly question: string;
  readonly tag: string;
  readonly short: string;
}

function joinNames(names: readonly string[]): string {
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

const { profile, experience, projects, languages, education } = knowledgeBase;

const liveProducts = joinNames(
  projects.filter((project) => project.live).map((project) => project.name),
);

// A tuple, so the first topic is a known fallback rather than a possibly-undefined index.
export const topics = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'home',
    intro: `Here's the short version: ${profile.firstName} is a Staff-level frontend engineer with ${profile.yearsLabel} in React, TypeScript and frontend architecture, with measurable wins in performance and team growth. What would you like to know?`,
    questions: [
      { question: "Tell me about Marcio's career.", tag: 'Career', short: 'His career' },
      {
        question: 'What makes Marcio a strong Staff Engineer?',
        tag: 'Staff-level',
        short: 'Why Staff-level',
      },
      { question: 'What has he built at Deel?', tag: 'Deel', short: 'Work at Deel' },
      {
        question: 'How experienced is he with React and TypeScript?',
        tag: 'React & TypeScript',
        short: 'React & TypeScript',
      },
      {
        question: 'What are his biggest technical achievements?',
        tag: 'Impact',
        short: 'Biggest wins',
      },
      { question: 'Has he led engineering teams?', tag: 'Leadership', short: 'Leadership' },
      { question: 'What projects is he working on?', tag: 'Projects', short: 'Side projects' },
      {
        question: 'How does he approach frontend architecture?',
        tag: 'Architecture',
        short: 'Architecture',
      },
    ],
  },
  {
    id: 'experience',
    label: 'Experience',
    icon: 'briefcase',
    intro: `Marcio's career spans ${String(experience.length)} roles since ${String(profile.careerStartYear)} — from freelance web development to lead and senior frontend roles at Roots, Deel and, today, Toptal. Pick a company, or ask how his scope grew over time.`,
    questions: [
      { question: "Tell me about Marcio's career.", tag: 'Career' },
      { question: 'What has he built at Deel?', tag: 'Deel' },
      { question: 'What did he do at Roots?', tag: 'Roots' },
      { question: 'What is he working on at Toptal?', tag: 'Toptal' },
      { question: 'Tell me about his experience scaling frontend applications.', tag: 'Scale' },
      { question: 'Has he ever built something from scratch?', tag: 'Zero to one' },
      { question: 'Is he experienced with enterprise applications?', tag: 'Enterprise' },
      { question: 'Has he worked with backend systems?', tag: 'Full stack' },
    ],
  },
  {
    id: 'skills',
    label: 'Technical Skills',
    icon: 'code',
    intro:
      "Marcio's core stack is React, TypeScript and Next.js, backed by architecture, performance and leadership skills. Ask about any area and you'll get the evidence behind it, not a self-rated score.",
    questions: [
      { question: 'How experienced is he with React and TypeScript?', tag: 'React & TypeScript' },
      { question: 'What are his strongest technical skills?', tag: 'Strengths' },
      { question: 'How did he optimize performance?', tag: 'Performance' },
      { question: 'Has he worked with backend systems?', tag: 'Full stack' },
      { question: 'Does he have Next.js and SSR experience?', tag: 'Next.js' },
      { question: 'What does he know about design systems?', tag: 'Design systems' },
      { question: 'How does he approach accessibility?', tag: 'Accessibility' },
      { question: 'How does he approach testing?', tag: 'Testing' },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'folder',
    intro: `Beyond his day job, Marcio builds his own products. ${liveProducts} already have public sites, and FictionDraft is still a concept. Ask about any of them — I'll be clear about what's live versus planned.`,
    questions: [
      { question: 'What projects is he working on?', tag: 'All products' },
      { question: 'Tell me more about EvCopilot.', tag: 'EvCopilot' },
      { question: 'Tell me more about FormDaily.', tag: 'FormDaily' },
      { question: 'What is TargUp?', tag: 'TargUp' },
      { question: 'What is FictionDraft?', tag: 'FictionDraft' },
      { question: 'Has he built mobile apps?', tag: 'Mobile' },
    ],
  },
  {
    id: 'achievements',
    label: 'Achievements',
    icon: 'award',
    intro: `Highlights include a ${metricValue('deel-critical-load')} cut in critical page loading time and Web Vitals improved by ${metricValue('deel-web-vitals')} at Deel, plus growing the Roots engineering team from one to four developers. Ask for the context behind any of them.`,
    questions: [
      { question: 'What are his biggest technical achievements?', tag: 'Impact' },
      { question: 'What measurable improvements has he delivered?', tag: 'Metrics' },
      { question: 'How did he optimize performance?', tag: 'Performance' },
      { question: 'How does he raise code quality?', tag: 'Quality' },
      { question: 'How did he grow the team at Roots?', tag: 'Team growth' },
      { question: 'Has he received any awards?', tag: 'Recognition' },
    ],
  },
  {
    id: 'philosophy',
    label: 'Engineering Philosophy',
    icon: 'compass',
    intro: `${profile.focus.replace(/^He/, 'Marcio')} Ask how those principles show up in his work.`,
    questions: [
      { question: "What's his engineering philosophy?", tag: 'Principles' },
      { question: 'How does he approach frontend architecture?', tag: 'Architecture' },
      { question: 'Show me examples of architectural decisions.', tag: 'Decisions' },
      { question: 'How does he work with product teams?', tag: 'Product' },
      { question: 'How does he think about code quality?', tag: 'Quality' },
    ],
  },
  {
    id: 'education',
    label: 'Education & Languages',
    icon: 'graduation',
    intro: `Marcio holds a ${education.degree.replace("Bachelor's Degree", "Bachelor's degree")} from ${education.school} (${String(education.year)}) and works in ${joinNames(languages.map((language) => language.name))}.`,
    questions: [
      { question: 'Where did he study?', tag: 'Education' },
      { question: 'What languages does he speak?', tag: 'Languages' },
      { question: 'Does he speak French?', tag: 'Languages' },
      { question: 'What courses and certifications does he have?', tag: 'Certifications' },
      { question: 'Can I see his resume?', tag: 'Resume' },
    ],
  },
] as const satisfies readonly Topic[];

export function topicById(id: string): Topic {
  return topics.find((topic) => topic.id === id) ?? topics[0];
}

/** Rotates through a topic's pool so the screen never lists every prompt at once. */
export function suggestedQuestions(
  topicId: string,
  page: number,
  count: number,
): SuggestedQuestion[] {
  const pool = topicById(topicId).questions;
  const size = Math.min(count, pool.length);
  const start = (page * size) % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.slice(0, size).map(({ question, tag, short }) => ({
    question,
    tag,
    short: short ?? tag,
  }));
}

/** The same rotation, as the bare questions. */
export function suggestions(topicId: string, page: number, count: number): string[] {
  return suggestedQuestions(topicId, page, count).map((suggestion) => suggestion.question);
}
