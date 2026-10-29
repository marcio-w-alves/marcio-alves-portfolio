import { describe, expect, it } from 'vitest';
import { buildContainer } from '@/composition-root';
import type { AnswerSet } from '@/core/assistant/answer-set';
import { compileLocaleCopy } from '@/core/assistant/copy/compile';
import type { CopyDocuments } from '@/core/assistant/copy/copy-document';
import type { AssistantEvent } from '@/core/chat/events';
import type { Locale, Translations } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import { answerTranscript, suggestedQuestions } from '@/testing/answer-transcript';
import { exampleCopy } from '@/testing/copy-documents';
import { withoutAnswer } from '@/testing/copy-variants';
import { fixtureAnswers, fixturePortugueseAnswers } from '@/testing/fixture-profile/answers';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { createChatHandler } from './chat-handler';

/**
 * The example's compiled copy answering through the real route: the real
 * composition, the real fast path and the real event stream, with no model
 * configured, so every answer is one the copy wrote.
 */

const LOCALES: readonly Locale[] = ['en', 'pt-BR'];

function compiled(locale: Locale, documents: CopyDocuments = exampleCopy(locale)) {
  return compileLocaleCopy(documents, { locale, limits: {}, identity: {} }).answers;
}

function chatWith(answers: Translations<AnswerSet>) {
  return createChatHandler(
    buildContainer({
      record: fixtureKnowledge,
      answers,
      env: { OPENAI_API_KEY: undefined, GITHUB_TOKEN: undefined },
    }),
  );
}

let visitors = 0;

function ask(message: string, locale: Locale): Request {
  visitors += 1;
  return new Request('https://portfolio.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `198.51.100.${String(visitors)}` },
    body: JSON.stringify({ message, locale }),
  });
}

async function eventsOf(response: Response): Promise<AssistantEvent[]> {
  const body = await response.text();
  return body
    .split('\n\n')
    .filter((frame) => frame.startsWith('data: '))
    .map((frame) => JSON.parse(frame.slice('data: '.length)) as AssistantEvent);
}

/** Every question a locale's copy suggests: the topics' and every answer's follow-ups. */
function questionsOf(answers: AnswerSet, locale: Locale): string[] {
  return suggestedQuestions(answerTranscript(answers, localize(fixtureKnowledge, locale)));
}

const TYPESCRIPT = { en: fixtureAnswers, 'pt-BR': fixturePortugueseAnswers };

describe('the compiled example copy through the chat route', () => {
  const data = { en: compiled('en'), 'pt-BR': compiled('pt-BR') };

  it.each(LOCALES)(
    'answers every %s question it suggests as the TypeScript copy did',
    async (locale) => {
      const fromData = chatWith(data);
      const fromCode = chatWith(TYPESCRIPT);
      const suggested = questionsOf(data[locale], locale);
      let answered = 0;
      for (const question of suggested) {
        const response = await fromData(ask(question, locale));
        expect(response.status).toBe(200);
        const events = await eventsOf(response);
        expect(events).toEqual(await eventsOf(await fromCode(ask(question, locale))));
        const [start] = events;
        const finish = events.at(-1);
        expect(finish?.type).toBe('finish');
        if (finish?.type === 'finish') {
          expect(suggested).toEqual(expect.arrayContaining([...finish.followUps]));
        }
        if (start?.type === 'start' && start.intent !== 'unknown') answered += 1;
      }
      expect(answered).toBeGreaterThan(suggested.length / 2);
    },
  );

  it('does not offer an answer the copy leaves out (AC-23.1)', async () => {
    const question = 'Did she lead the payroll team?';
    const full = await eventsOf(await chatWith(data)(ask(question, 'en')));
    expect(full[0]).toMatchObject({ type: 'start', intent: 'leadRole' });

    const withoutLeadRole = {
      ...data,
      en: compiled('en', withoutAnswer(exampleCopy('en'), 'leadRole')),
    };
    const response = await chatWith(withoutLeadRole)(ask(question, 'en'));
    expect(response.status).toBe(200);
    const events = await eventsOf(response);
    expect(events[0]).toMatchObject({ type: 'start' });
    expect(events[0]).not.toMatchObject({ intent: 'leadRole' });
    const text = events.map((event) => (event.type === 'text-delta' ? event.delta : '')).join('');
    expect(text).not.toContain('[leadRole]');
    expect(text.length).toBeGreaterThan(0);
  });
});
