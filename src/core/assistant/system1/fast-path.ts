import type { Knowledge } from '@/core/knowledge/schema';
import type { AssistantResponse, ConversationContext } from '../response';
import { createResponseKit } from '../response-kit';
import { createBoundaryAnswers } from './responses/boundaries';
import { createCareerAnswers } from './responses/career';
import { createExpertiseAnswers } from './responses/expertise';
import { createRouter, type ScoredIntent } from './router';
import { createEvidenceFinder } from './technologies';

/**
 * System 1: answers what can be recognized with certainty, straight from the
 * knowledge base, without spending a token. Anything else is escalated —
 * with the closest intent it saw, so the model-backed path can still offer
 * relevant follow-ups.
 */

export type FastPathResult =
  | { readonly kind: 'answered'; readonly response: AssistantResponse }
  | { readonly kind: 'escalate'; readonly nearest: ScoredIntent | null };

export interface FastPath {
  readonly answer: (question: string, context: ConversationContext) => FastPathResult;
  /**
   * The follow-ups the fast path would offer for an intent — every one of them a
   * question it can answer — so an escalated answer still suggests only
   * questions that cost nothing.
   */
  readonly followUpsFor: (
    intent: ScoredIntent | null,
    context: ConversationContext,
  ) => readonly string[];
  /** The answer of last resort, used only when the model-backed path is unavailable. */
  readonly unknown: () => AssistantResponse;
  /** For a visitor who has used up their share of model answers. */
  readonly slowDown: (followUps: readonly string[]) => AssistantResponse;
}

type ScoredAnswers = Readonly<
  Record<ScoredIntent, (context: ConversationContext, question: string) => AssistantResponse>
>;

function answered(response: AssistantResponse): FastPathResult {
  return { kind: 'answered', response };
}

export function createFastPath(knowledge: Knowledge): FastPath {
  const kit = createResponseKit(knowledge);
  const boundaries = createBoundaryAnswers(kit);
  const career = createCareerAnswers(kit);
  const expertise = createExpertiseAnswers(kit);
  const route = createRouter(knowledge);
  const findEvidence = createEvidenceFinder(knowledge);
  const scoredAnswers: ScoredAnswers = {
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
    aiEngineering: expertise.aiEngineering,
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

  function answer(question: string, context: ConversationContext): FastPathResult {
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
        return answered(scoredAnswers[routed.intent](context, question));
    }
  }

  return {
    answer,
    followUpsFor: (intent, context) =>
      intent ? scoredAnswers[intent](context, '').followUps : boundaries.greeting().followUps,
    unknown: boundaries.unknown,
    slowDown: boundaries.slowDown,
  };
}
