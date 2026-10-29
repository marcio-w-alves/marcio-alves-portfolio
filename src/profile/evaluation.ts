import { z } from 'zod';
import type { HistoryTurn } from '@/core/chat/request';
import { SUPPORTED_LOCALES, type Locale } from '@/core/i18n/locale';

/**
 * The conversations the assistant is held to, and the answers its judge is
 * checked on first. Each profile writes its own, against its own record; this
 * is their shape and what a profile's are validated with.
 */

export const CATEGORIES = [
  'career',
  'leadership',
  'product-vs-person',
  'technology',
  'company',
  'profiles',
  'location',
  'undocumented',
  'off-topic',
  'injection',
  'conversation',
  'language',
  'notes',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Expectation {
  /** Which path should answer: the deterministic fast path or the model. */
  readonly path?: 'fast' | 'model';
  /** A refusal: no sources, nothing presented as documented. */
  readonly declines?: boolean;
  readonly language?: 'en' | 'pt' | 'es';
  /** Case-insensitive fragments the answer must contain. */
  readonly mentions?: readonly string[];
  /** Fragments that would mean a fabrication or a leak. */
  readonly avoids?: readonly string[];
  /** Sources the answer must cite, by id. */
  readonly cites?: readonly string[];
}

/** One conversation: a correct answer must do what `expect` states, and the judge checks every claim. */
export interface EvaluationCase {
  readonly id: string;
  readonly category: Category;
  readonly question: string;
  /** The language of the page it is asked on; English when not given. */
  readonly pageLocale?: Locale;
  readonly history?: readonly HistoryTurn[];
  readonly expect: Expectation;
}

/**
 * An answer the judge must grade right before its verdicts count: a true one
 * must pass, and every planted fabrication must be caught.
 */
export interface CalibrationItem {
  readonly answer: string;
  /** How many of its claims the evidence does not support. */
  readonly planted: number;
  /** The actions whose results are the evidence; without one, the whole knowledge base is. */
  readonly actions?: readonly { readonly name: string; readonly arguments: object }[];
}

export interface Evaluation {
  readonly cases: readonly EvaluationCase[];
  readonly calibration: readonly CalibrationItem[];
}

const text = z.string().regex(/\S/);
const fragments = z.array(text).min(1);

const evaluationCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'Must be a lowercase id, e.g. "career-overview"'),
  category: z.enum(CATEGORIES),
  question: text,
  pageLocale: z.enum(SUPPORTED_LOCALES).optional(),
  history: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), text: text })).optional(),
  expect: z.strictObject({
    path: z.enum(['fast', 'model']).optional(),
    declines: z.boolean().optional(),
    language: z.enum(['en', 'pt', 'es']).optional(),
    mentions: fragments.optional(),
    avoids: fragments.optional(),
    cites: fragments.optional(),
  }),
});

const calibrationItemSchema = z.strictObject({
  answer: text,
  planted: z.number().int().nonnegative(),
  actions: z
    .array(z.strictObject({ name: text, arguments: z.record(z.string(), z.unknown()) }))
    .min(1)
    .optional(),
});

export const evaluationSchema = z.strictObject({
  cases: z.array(evaluationCaseSchema),
  calibration: z.array(calibrationItemSchema),
});
