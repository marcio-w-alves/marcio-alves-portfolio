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

function scoredIn(locale: Locale) {
  return ANSWERS[locale].answers(
    createResponseKit(localize(source, locale), ANSWERS[locale].labels),
  ).scored;
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
      const portuguese = scoredIn('pt-BR')[intent](FRESH, '').followUps;
      const twins = scoredIn('en')[intent](FRESH, '').followUps;
      expect(portuguese.map((question) => intentOf('pt-BR', question))).toEqual(
        twins.map((question) => intentOf('en', question)),
      );
    },
  );
});

describe('fast path — the Portuguese suggestion graph is closed', () => {
  it.each(['en', 'pt-BR'] as const)(
    'answers every Portuguese question the site can suggest, in Portuguese, on the %s page',
    (pageLocale) => {
      const pending = topicsIn('pt-BR').flatMap((topic) =>
        topic.questions.map((item) => item.question),
      );
      const visited = new Set<string>();
      for (let question = pending.pop(); question !== undefined; question = pending.pop()) {
        if (visited.has(question)) continue;
        visited.add(question);
        expect(detectLanguage(question), question).toBe('pt-BR');
        const result = fastPath.answer(question, FRESH, pageLocale);
        expect(result.kind, `"${question}" was escalated`).toBe('answered');
        if (result.kind === 'answered') pending.push(...result.response.followUps);
      }
      expect(visited.size).toBeGreaterThan(40);
    },
  );
});
