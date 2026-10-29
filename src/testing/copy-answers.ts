import { compileLocaleCopy } from '@/core/assistant/copy/compile';
import type { AssistantResponse } from '@/core/assistant/response';
import { createResponseKit } from '@/core/assistant/response-kit';
import type { Locale } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import type { KnowledgeSource } from '@/core/knowledge/schema';
import { exampleCopy } from './copy-documents';
import { textAnswer, withAnswer } from './copy-variants';
import { fixtureKnowledge } from './fixture-profile/knowledge';

/**
 * The template language as a profile meets it: one answer written into the
 * example's copy, compiled, and read back from what the fast path would say.
 */

export interface Over {
  readonly locale?: Locale;
  readonly record?: KnowledgeSource;
}

/** The example's answers, over the fixture's record, with one answer written anew. */
export function answersFrom(
  answer: Readonly<Record<string, unknown>>,
  answerId: string,
  { locale = 'en', record = fixtureKnowledge }: Over = {},
) {
  const copy = compileLocaleCopy(withAnswer(exampleCopy(locale), answerId, answer), {
    locale,
    limits: {},
    identity: {},
  });
  return copy.answers.answers(createResponseKit(localize(record, locale), copy.answers.labels));
}

export function firstText(response: AssistantResponse): string {
  const [part] = response.parts;
  if (part?.type !== 'text') throw new Error('The answer opens with no text.');
  return part.text;
}

/** What the greeting says when its one part is the template. */
export function say(template: string, over: Over = {}): string {
  return firstText(answersFrom(textAnswer(template), 'greeting', over).greeting());
}

/** What the answer about a role says when its one part is the template. */
export function sayAbout(roleId: string, template: string, locale: Locale = 'en'): string {
  return firstText(answersFrom(textAnswer(template), 'company', { locale }).company(roleId));
}
