import { describe, expect, it } from 'vitest';
import type { AnswerSet } from '@/core/assistant/answer-set';
import { detectLanguage } from '@/core/assistant/language';
import { createResponseKit } from '@/core/assistant/response-kit';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import { SCORED_INTENTS } from '@/core/assistant/system1/intents';
import { createRouter } from '@/core/assistant/system1/router';
import { createTopicCatalog } from '@/core/assistant/topics';
import type { ConversationContext } from '@/core/chat/request';
import type { Locale } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import { scoredAnswer } from '@/testing/scored-answer';
import { answers } from '.';
import { knowledge as source } from '../../../knowledge';
import { answers as englishAnswers } from '../../en/answers';

/**
 * How the Portuguese questions route: each one the site suggests in
 * Portuguese must reach the answer its English twin reaches, so a visitor
 * reading in Portuguese is answered as well as one reading in English.
 */

const FRESH: ConversationContext = { topic: 'overview', lastIntent: null, ctaShown: false };

const ANSWERS: Readonly<Record<Locale, AnswerSet>> = { en: englishAnswers, 'pt-BR': answers };

const routers = {
  en: createRouter(localize(source, 'en'), englishAnswers.vocabulary, 'en'),
  'pt-BR': createRouter(localize(source, 'pt-BR'), answers.vocabulary, 'pt-BR'),
};

function intentOf(locale: Locale, question: string): string {
  const routed = routers[locale](question, FRESH);
  if (routed.intent === 'company') return `company:${routed.role}`;
  if (routed.intent === 'project') return `project:${routed.project}`;
  return routed.intent;
}

function topicsIn(locale: Locale) {
  const kit = createResponseKit(localize(source, locale), ANSWERS[locale].labels);
  return createTopicCatalog(ANSWERS[locale].topics(kit)).topics;
}

function answersIn(locale: Locale) {
  return ANSWERS[locale].answers(
    createResponseKit(localize(source, locale), ANSWERS[locale].labels),
  );
}

const fastPath = createFastPath({
  en: { knowledge: localize(source, 'en'), answers: englishAnswers },
  'pt-BR': { knowledge: localize(source, 'pt-BR'), answers },
});

describe('router — every Portuguese suggestion leads where its English twin does', () => {
  const english = topicsIn('en');

  it.each(topicsIn('pt-BR').map((topic, index) => [topic.id, topic, index] as const))(
    'routes each question suggested on %s like the English one',
    (_id, topic, index) => {
      const twins = english[index]?.questions ?? [];
      expect(topic.questions.map(({ question }) => intentOf('pt-BR', question))).toEqual(
        twins.map(({ question }) => intentOf('en', question)),
      );
    },
  );

  it.each(SCORED_INTENTS)(
    'routes the follow-ups of the %s answer like the English ones',
    (intent) => {
      const portuguese = scoredAnswer(answersIn('pt-BR'), intent)(FRESH, '').followUps;
      const twins = scoredAnswer(answersIn('en'), intent)(FRESH, '').followUps;
      expect(portuguese.map((question) => intentOf('pt-BR', question))).toEqual(
        twins.map((question) => intentOf('en', question)),
      );
    },
  );
});

describe('fast path — the Portuguese suggestion graph is closed', () => {
  it.each(['en', 'pt-BR'] as const)(
    'answers every Portuguese question the site can suggest, in Portuguese, on every %s page',
    (pageLocale) => {
      // Each page starts from its own questions and keeps its context as the visitor follows up.
      const pending = topicsIn('pt-BR').flatMap((topic) =>
        topic.questions.map((item) => ({ topic: topic.id, question: item.question })),
      );
      const visited = new Set<string>();
      for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
        const { topic, question } = node;
        if (visited.has(`${topic}:${question}`)) continue;
        visited.add(`${topic}:${question}`);
        expect(detectLanguage(question), question).toBe('pt-BR');
        const result = fastPath.answer(question, { ...FRESH, topic }, pageLocale);
        expect(result.kind, `"${question}" on ${topic} was escalated`).toBe('answered');
        if (result.kind === 'answered') {
          pending.push(
            ...result.response.followUps.map((followUp) => ({ topic, question: followUp })),
          );
        }
      }
      expect(visited.size).toBeGreaterThan(40);
    },
  );
});
