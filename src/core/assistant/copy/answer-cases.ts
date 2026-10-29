import type { ConversationContext } from '../../chat/request';
import type { Knowledge } from '@/core/knowledge/schema';
import type { Answers } from '../answer-set';
import type { AssistantResponse } from '../response';
import { SCORED_INTENTS } from '../system1/intents';
import {
  TECHNOLOGIES,
  createEvidenceFinder,
  type TechnologyEvidence,
} from '../system1/technologies';

/**
 * Every input an answer set can be asked over a record: each intent with and
 * without the contact card already shown, each language a visitor may name
 * (and none), each role, each project, each technology alone and a documented
 * one beside an undocumented one, and a slowed-down visitor with and without
 * suggestions. Rendering all of them proves a copy before anyone reads it.
 */

export interface AnswerCase {
  readonly key: string;
  /** Null where the answer set leaves the intent out. */
  readonly respond: (answers: Answers) => AssistantResponse | null;
}

function context(ctaShown: boolean): ConversationContext {
  return { topic: 'overview', lastIntent: null, ctaShown };
}

const SUGGESTED = ['Suggested question one?', 'Suggested question two?'];

function scoredCases(knowledge: Knowledge): AnswerCase[] {
  return [false, true].flatMap((ctaShown) =>
    SCORED_INTENTS.flatMap((intent) => {
      const questions =
        intent === 'languages'
          ? ['', ...knowledge.languages.map((language) => language.name)]
          : [''];
      return questions.map((question): AnswerCase => ({
        key: `${intent}${question ? `:${question}` : ''}${ctaShown ? ':ctaShown' : ''}`,
        respond: (answers) => answers.scored[intent]?.(context(ctaShown), question) ?? null,
      }));
    }),
  );
}

function isDocumented(evidence: TechnologyEvidence): boolean {
  return evidence.work.length > 0 || evidence.skills.length > 0;
}

/** Each technology's evidence alone, then a documented one beside an undocumented one. */
export function technologyEvidenceSets(knowledge: Knowledge): (readonly TechnologyEvidence[])[] {
  const evidence = TECHNOLOGIES.map(createEvidenceFinder(knowledge));
  const alone = evidence.map((item) => [item]);
  const documented = evidence.find(isDocumented);
  const undocumented = evidence.find((item) => !isDocumented(item));
  return documented && undocumented ? [...alone, [documented, undocumented]] : alone;
}

function technologyCases(knowledge: Knowledge): AnswerCase[] {
  return technologyEvidenceSets(knowledge).map((evidence): AnswerCase => ({
    key: `technology:${evidence.map((item) => item.technology.name).join('+')}`,
    respond: (answers) => answers.technology(evidence),
  }));
}

export function answerCases(knowledge: Knowledge): AnswerCase[] {
  return [
    ...scoredCases(knowledge),
    { key: 'greeting', respond: (answers) => answers.greeting() },
    { key: 'privateInfo', respond: (answers) => answers.privateInfo() },
    { key: 'offPurpose', respond: (answers) => answers.offPurpose() },
    { key: 'unknown', respond: (answers) => answers.unknown() },
    { key: 'slowDown', respond: (answers) => answers.slowDown([]) },
    { key: 'slowDown:suggested', respond: (answers) => answers.slowDown(SUGGESTED) },
    ...knowledge.experience.map((role): AnswerCase => ({
      key: `company:${role.id}`,
      respond: (answers) => answers.company(role.id),
    })),
    ...knowledge.projects.map((project): AnswerCase => ({
      key: `project:${project.id}`,
      respond: (answers) => answers.project(project.id),
    })),
    ...technologyCases(knowledge),
  ];
}
