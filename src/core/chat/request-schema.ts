import { z } from 'zod';
import {
  MAX_HISTORY_TEXT,
  MAX_HISTORY_MESSAGES,
  MAX_QUESTION_LENGTH,
  type ChatRequest,
} from './request';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../i18n/locale';
import { TOPIC_IDS } from './topic-id';

/**
 * The request as the endpoint validates it. Everything in it is untrusted:
 * the context only steers suggestions, and the history only gives the model
 * conversational memory — neither can grant anything. Kept apart from the
 * limits so the client reads them without bundling zod.
 */
export const chatRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  history: z
    .array(
      z.strictObject({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(MAX_HISTORY_TEXT),
      }),
    )
    .max(MAX_HISTORY_MESSAGES)
    .default([]),
  context: z
    .strictObject({
      topic: z.enum(TOPIC_IDS),
      lastIntent: z.string().max(80).nullable(),
      ctaShown: z.boolean(),
    })
    .default({ topic: 'overview', lastIntent: null, ctaShown: false }),
  locale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
}) satisfies z.ZodType<ChatRequest>;
