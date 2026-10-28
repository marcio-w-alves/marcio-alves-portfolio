import type { Knowledge } from '@/core/knowledge/schema';
import type { ResponsePart } from '../../chat/components';
import type { ConversationContext } from '../../chat/request';
import type { AnswerSet } from '../answer-set';
import type { AssistantResponse } from '../response';
import { createResponseKit } from '../response-kit';
import { summarizePage } from '../page-summary';
import { createTopicIntro } from '../topic-pages';
import { createTopicCatalog } from '../topics';
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

function answered(response: AssistantResponse): FastPathResult {
  return { kind: 'answered', response };
}

const FOLLOW_UPS = 3;

const partKey = (part: ResponsePart): string => JSON.stringify(part);

export function createFastPath(knowledge: Knowledge, answerSet: AnswerSet): FastPath {
  const kit = createResponseKit(knowledge);
  const answers = answerSet.answers(kit);
  const route = createRouter(knowledge, answerSet.vocabulary);
  const findEvidence = createEvidenceFinder(knowledge);
  const catalog = createTopicCatalog(answerSet.topics(kit));
  const topicIntro = createTopicIntro(catalog);

  // What the visitor already sees: a topic page opens on its part of the
  // record, so an answer there leaves that part out. The overview opens on
  // the welcome screen, which shows none of it.
  function shownOnPage(context: ConversationContext): ReadonlySet<string> {
    if (context.topic === 'overview') return new Set();
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
    const result = respond(question, { ...context, lastIntent: current.intent });
    if (result.kind !== 'answered') return true;
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
        return answered(answers.offPurpose());
      case 'privateInfo':
        return answered(answers.privateInfo());
      case 'greeting':
        return answered(answers.greeting());
      case 'company':
        return answered(answers.company(routed.role));
      case 'project':
        return answered(answers.project(routed.project));
      case 'technology': {
        const evidence = routed.technologies.map(findEvidence);
        // Only the résumé is answered here; a technology the notes report needs
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
          : answered(answers.technology(evidence));
      }
      default:
        return answered(answers.scored[routed.intent](context, question));
    }
  }

  return {
    answer,
    followUpsFor: (intent, context) =>
      intent ? answers.scored[intent](context, '').followUps : answers.greeting().followUps,
    pageShown: (context) =>
      context.topic === 'overview'
        ? null
        : {
            label: catalog.topicById(context.topic).label,
            summary: summarizePage(topicIntro(context.topic).parts),
            cards: topicIntro(context.topic).parts.flatMap((part) =>
              part.type === 'component' ? [part.component] : [],
            ),
          },
    unknown: answers.unknown,
    slowDown: answers.slowDown,
  };
}
