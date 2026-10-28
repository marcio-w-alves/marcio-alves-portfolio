import type { AssistantResponse, ConversationContext } from '../response';
import * as boundaries from './responses/boundaries';
import * as career from './responses/career';
import * as expertise from './responses/expertise';
import { route, type ScoredIntent } from './router';
import { findEvidence } from './technologies';

/**
 * System 1: answers what can be recognized with certainty, straight from the
 * knowledge base, without spending a token. Anything else is escalated —
 * with the closest intent it saw, so the model-backed path can still offer
 * relevant follow-ups.
 */

export type FastPathResult =
  | { readonly kind: 'answered'; readonly response: AssistantResponse }
  | { readonly kind: 'escalate'; readonly nearest: ScoredIntent | null };

const SCORED_ANSWERS: Readonly<
  Record<ScoredIntent, (context: ConversationContext, question: string) => AssistantResponse>
> = {
  identity: boundaries.identity,
  resume: expertise.resume,
  contact: expertise.contact,
  location: expertise.location,
  accessibility: expertise.accessibility,
  testing: expertise.testing,
  mobile: expertise.mobile,
  designSystems: expertise.designSystems,
  nextjs: expertise.nextjs,
  codeQuality: expertise.codeQuality,
  quality: career.quality,
  awards: career.awards,
  teamGrowth: career.teamGrowth,
  hrisRole: career.hrisRole,
  product: career.product,
  scratch: career.scratch,
  scaling: career.scaling,
  enterprise: career.enterprise,
  staffFit: career.staffFit,
  philosophy: expertise.philosophy,
  architecture: expertise.architecture,
  performance: expertise.performance,
  backend: expertise.backend,
  react: expertise.react,
  skills: expertise.skills,
  leadership: career.leadership,
  achievements: career.achievements,
  projects: expertise.projects,
  languages: (_context, question) => expertise.languages(question),
  education: expertise.education,
  career: career.career,
};

function answered(response: AssistantResponse): FastPathResult {
  return { kind: 'answered', response };
}

export function fastPath(question: string, context: ConversationContext): FastPathResult {
  const routed = route(question, context);
  switch (routed.intent) {
    case 'escalate':
      return { kind: 'escalate', nearest: routed.nearest };
    case 'offPurpose':
      return answered(boundaries.offPurpose());
    case 'privateInfo':
      return answered(boundaries.privateInfo());
    case 'greeting':
      return answered(boundaries.greeting());
    case 'company':
      return answered(career.company(routed.role));
    case 'project':
      return answered(expertise.project(routed.project));
    case 'technology': {
      const evidence = routed.technologies.map(findEvidence);
      // Only the résumé is answered here; a technology his notes report needs
      // the model, which reads the note's evidence tag.
      const onlyInNotes = evidence.some(
        (item) =>
          item.work.length === 0 &&
          item.skills.length === 0 &&
          item.coursework.length === 0 &&
          item.notes.length > 0,
      );
      return onlyInNotes
        ? { kind: 'escalate', nearest: null }
        : answered(boundaries.technology(evidence));
    }
    default:
      return answered(SCORED_ANSWERS[routed.intent](context, question));
  }
}

/**
 * The follow-ups the fast path would offer for an intent — every one of them a
 * question it can answer — so an escalated answer still suggests only
 * questions that cost nothing.
 */
export function followUpsFor(
  intent: ScoredIntent | null,
  context: ConversationContext,
): readonly string[] {
  return intent ? SCORED_ANSWERS[intent](context, '').followUps : boundaries.greeting().followUps;
}
