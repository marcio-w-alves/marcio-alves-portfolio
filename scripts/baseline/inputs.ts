/**
 * What a baseline asks the site, written once from the commit before any
 * change and reused by every comparison: the same inputs, so the outputs can
 * be compared. Plain strings only — this file is read by later versions of
 * the tool, against builds whose types may have moved.
 */

export const INPUTS_FORMAT = 1;

export interface PageInput {
  readonly id: string;
  readonly locale: string;
  readonly path: string;
}

/**
 * How a route's response is compared: bytes for every kind, plus the sitemap's
 * URLs one by one and an image's pixels.
 */
export type RouteKind = 'sitemap' | 'text' | 'image' | 'asset';

export interface RouteInput {
  readonly id: string;
  readonly path: string;
  readonly kind: RouteKind;
}

export interface AnswerContext {
  readonly topic: string;
  readonly lastIntent: string | null;
  readonly ctaShown: boolean;
}

/** Where a question came from, so a reader of the report knows why it is asked. */
export type AnswerOrigin = 'topic' | 'follow-up' | 'entity' | 'evaluation';

export interface AnswerInput {
  readonly id: string;
  readonly origin: AnswerOrigin;
  readonly locale: string;
  readonly message: string;
  readonly context: AnswerContext;
}

export interface BaselineInputs {
  readonly format: typeof INPUTS_FORMAT;
  readonly locales: readonly string[];
  readonly pages: readonly PageInput[];
  readonly routes: readonly RouteInput[];
  readonly answers: readonly AnswerInput[];
  readonly retrievalProbes: readonly string[];
}

/** One probe's ranked passages, as the site's search returns them for the probe's stored vector. */
export interface RetrievalResult {
  readonly probe: string;
  readonly results:
    readonly { readonly id: string; readonly category: string; readonly score: number }[] | null;
}
