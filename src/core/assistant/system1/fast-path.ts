import type { Knowledge } from '@/core/knowledge/schema';
import type { AssistantResponse, ConversationContext, ResponsePart } from '../response';
import { createResponseKit } from '../response-kit';
import { summarizePage } from '../page-summary';
import { createTopicIntro } from '../topic-pages';
import { createTopicCatalog, isTopicId } from '../topics';
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

export interface PageShown {
  readonly label: string;
  readonly summary: string;
  /** The cards the page already shows, which an answer there leaves out. */
  readonly cards: readonly string[];
}

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
  /** What the visitor's topic page already shows, for the model to build on; null on the overview. */
  readonly pageShown: (context: ConversationContext) => PageShown | null;
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

const FOLLOW_UPS = 3;

const partKey = (part: ResponsePart): string => JSON.stringify(part);

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

  const catalog = createTopicCatalog(kit);
  const topicIntro = createTopicIntro(kit, catalog);

  // What the visitor already sees: a topic page opens on its part of the
  // record, so an answer there leaves that part out. The overview opens on
  // the welcome screen, which shows none of it.
  function shownOnPage(context: ConversationContext): ReadonlySet<string> {
    if (context.topic === 'overview' || !isTopicId(context.topic)) return new Set();
    return new Set(topicIntro(context.topic).parts.map(partKey));
  }

  // A lead-in sentence goes with the card it introduces: "He works in four
  // languages:" means nothing once the page's languages table is left out.
  function newParts(response: AssistantResponse, shown: ReadonlySet<string>): ResponsePart[] {
    const { parts } = response;
    const isShown = (index: number) => {
      const part = parts[index];
      return part !== undefined && shown.has(partKey(part));
    };
    const introducesShownCard = (index: number) => {
      const part = parts[index];
      const next = parts[index + 1];
      return (
        part?.type === 'text' &&
        !part.text.startsWith('#') &&
        next?.type === 'component' &&
        isShown(index + 1)
      );
    };
    return parts.filter((_part, index) => !isShown(index) && !introducesShownCard(index));
  }

  // A follow-up is worth suggesting only when it leads somewhere: not back to
  // the answer just given, and not to an answer the page already holds.
  function leadsSomewhereNew(
    question: string,
    current: AssistantResponse,
    context: ConversationContext,
    shown: ReadonlySet<string>,
  ): boolean {
    const result = tryRespond(question, { ...context, lastIntent: current.intent });
    if (result?.kind !== 'answered') return true;
    return result.response.intent !== current.intent && newParts(result.response, shown).length > 0;
  }

  function followUpsAfter(
    response: AssistantResponse,
    context: ConversationContext,
    shown: ReadonlySet<string>,
  ): string[] {
    const own = response.followUps.filter((question) =>
      leadsSomewhereNew(question, response, context, shown),
    );
    if (own.length > 0) return own;
    return catalog
      .topicById(context.topic)
      .questions.map((item) => item.question)
      .filter((question) => leadsSomewhereNew(question, response, context, shown))
      .slice(0, FOLLOW_UPS);
  }

  // Some ready answers still name records of Marcio's own (POR-54 moves them
  // into the profile), so with another profile they cannot be built. Judging a
  // follow-up must not break the answer it follows: such a follow-up is kept,
  // and fails, as before, only if the visitor asks it.
  function tryRespond(question: string, context: ConversationContext): FastPathResult | null {
    try {
      return respond(question, context);
    } catch {
      return null;
    }
  }

  function answer(question: string, context: ConversationContext): FastPathResult {
    const result = respond(question, context);
    if (result.kind !== 'answered') return result;
    const shown = shownOnPage(context);
    const parts = newParts(result.response, shown);
    return answered({
      ...result.response,
      parts: parts.length > 0 ? parts : result.response.parts,
      followUps: followUpsAfter(result.response, context, shown),
    });
  }

  function respond(question: string, context: ConversationContext): FastPathResult {
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
    pageShown: (context) =>
      context.topic === 'overview' || !isTopicId(context.topic)
        ? null
        : {
            label: catalog.topicById(context.topic).label,
            summary: summarizePage(topicIntro(context.topic).parts),
            cards: topicIntro(context.topic).parts.flatMap((part) =>
              part.type === 'component' ? [part.component] : [],
            ),
          },
    unknown: boundaries.unknown,
    slowDown: boundaries.slowDown,
  };
}
