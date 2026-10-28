import { describe, expect, it } from 'vitest';
import type { ConversationContext } from '@/core/assistant/response';
import { createRouter } from '@/core/assistant/system1/router';
import { localize } from '@/core/knowledge/localize';
import { answers } from '.';
import { knowledge as source } from '../../../knowledge';

/**
 * How the owner's questions route: the suggestions this profile writes, the
 * names visitors use for its companies, and its own vocabulary.
 */

const route = createRouter(localize(source, 'en'), answers.vocabulary);

const FRESH: ConversationContext = { topic: 'overview', lastIntent: null, ctaShown: false };

function intentOf(question: string): string {
  const routed = route(question, FRESH);
  if (routed.intent === 'company') return `company:${routed.role}`;
  if (routed.intent === 'project') return `project:${routed.project}`;
  return routed.intent;
}

describe('router — the questions the interface itself suggests', () => {
  it.each([
    ["Tell me about Marcio's career.", 'career'],
    ['What makes Marcio a strong Staff Engineer?', 'roleFit'],
    ['What has he built at Deel?', 'company:deel'],
    ['How experienced is he with React and TypeScript?', 'react'],
    ['What are his biggest technical achievements?', 'achievements'],
    ['Has he led engineering teams?', 'leadership'],
    ['What projects is he working on?', 'projects'],
    ['How does he approach frontend architecture?', 'architecture'],
    ['What did he do at Roots?', 'company:roots'],
    ['What is he working on at Way2b1?', 'company:way2b1'],
    ['Tell me about his experience scaling frontend applications.', 'scaling'],
    ['Has he ever built something from scratch?', 'scratch'],
    ['Is he experienced with enterprise applications?', 'enterprise'],
    ['Has he worked with backend systems?', 'backend'],
    ['What are his strongest technical skills?', 'skills'],
    ['How did he optimize performance?', 'performance'],
    ['Does he have Next.js and SSR experience?', 'nextjs'],
    ['What does he know about design systems?', 'designSystems'],
    ['How does he approach accessibility?', 'accessibility'],
    ['How does he approach testing?', 'testing'],
    ['Tell me more about EvCopilot.', 'project:evcopilot'],
    ['Tell me more about FormDaily.', 'project:formdaily'],
    ['Has he built mobile apps?', 'mobile'],
    ['What is FictionDraft?', 'project:fictiondraft'],
    ['What is TargUp?', 'project:targup'],
    ['What measurable improvements has he delivered?', 'achievements'],
    ['How did he reduce the bug backlog at Deel?', 'qualityImprovement'],
    ['How did he grow the team at Roots?', 'teamGrowth'],
    ['Has he received any awards?', 'awards'],
    ["What's his engineering philosophy?", 'philosophy'],
    ['Show me examples of architectural decisions.', 'architecture'],
    ['How does he work with product teams?', 'product'],
    ['How does he think about code quality?', 'codeQuality'],
    ['Where did he study?', 'education'],
    ['What languages does he speak?', 'languages'],
    ['Does he speak French?', 'languages'],
    ['What courses and certifications does he have?', 'education'],
    ['Can I see his resume?', 'resume'],
    ['What was his role in the HRIS team?', 'leadRole'],
    ['Would he fit a technical leadership position?', 'roleFit'],
    ['What did he do at Shall And Partners?', 'company:shall'],
    ['How can I contact Marcio?', 'contact'],
    ["What's his LinkedIn?", 'contact'],
  ])('routes %j to %s', (question, expected) => {
    expect(intentOf(question)).toBe(expected);
  });
});

describe('router — the names visitors use for his companies', () => {
  it.each([
    ['Maison', 'maison'],
    ['Shall & Partners', 'shall'],
    ['freelancing', 'freelance'],
    ['Way 2b1', 'way2b1'],
  ])('recognises %s by its alias', (alias, id) => {
    expect(intentOf(`What did he do at ${alias}?`)).toBe(`company:${id}`);
  });
});

describe('router — his own vocabulary', () => {
  it.each([
    ['What was his role in the HRIS team?', 'leadRole'],
    ['Did he study at UFPB?', 'education'],
    ['Which Udemy courses did he take?', 'education'],
    ['Tell me about the golden award.', 'awards'],
  ])('routes %j to %s', (question, expected) => {
    expect(intentOf(question)).toBe(expected);
  });

  it('declines a private question that names him with the accent his name carries in Portuguese', () => {
    expect(intentOf("What is Márcio's salary?")).toBe('privateInfo');
  });
});
