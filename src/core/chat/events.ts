import { RICH_COMPONENTS, type RichComponent } from './components';

/**
 * The streaming contract between the chat endpoint and the UI.
 *
 * These events mirror the protocol fixed by the approved design prototype,
 * so the interface and the server can evolve independently as long as both
 * keep emitting and reading this shape.
 */

export interface AnswerSource {
  readonly id: string;
  readonly label: string;
  /** Present for external references, so the interface can link to them. */
  readonly url?: string;
}

export const ASSISTANT_ERROR_CODES = [
  'network',
  'rate_limited',
  'timeout',
  'rejected',
  'internal',
  'interrupted',
] as const;
export type AssistantErrorCode = (typeof ASSISTANT_ERROR_CODES)[number];

/** What failed, never how to say it: the interface words each code for the visitor. */
export interface AssistantError {
  readonly code: AssistantErrorCode;
  readonly retryable: boolean;
  /** How long to wait before asking again, when the server said. */
  readonly retryAfterSeconds?: number;
}

export type AssistantEvent =
  | { readonly type: 'start'; readonly intent: string; readonly related: string | null }
  | { readonly type: 'text-start'; readonly id: string }
  | { readonly type: 'text-delta'; readonly id: string; readonly delta: string }
  | { readonly type: 'text-end'; readonly id: string }
  | ({ readonly type: 'component'; readonly id: string } & RichComponent)
  | {
      readonly type: 'finish';
      readonly followUps: readonly string[];
      readonly sources: readonly AnswerSource[];
    }
  | { readonly type: 'error'; readonly error: AssistantError };

type AssistantEventType = AssistantEvent['type'];

/** The answer stopped part-way; asking again may well succeed. */
export const INTERRUPTED = {
  type: 'error',
  error: { code: 'interrupted', retryable: true },
} as const satisfies AssistantEvent;

type Fields = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isListOf = (value: unknown, isItem: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(isItem);
const isOneOf = (value: unknown, allowed: readonly string[]) =>
  isString(value) && allowed.includes(value);

const isSource = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.label) &&
  (value.url === undefined || isString(value.url));

const isError = (value: unknown) =>
  isRecord(value) &&
  isOneOf(value.code, ASSISTANT_ERROR_CODES) &&
  typeof value.retryable === 'boolean' &&
  (value.retryAfterSeconds === undefined || typeof value.retryAfterSeconds === 'number');

// Keyed by the union, so an event type cannot be added without saying how it is recognized.
const HAS_SHAPE: Readonly<Record<AssistantEventType, (event: Fields) => boolean>> = {
  start: (event) => isString(event.intent) && (event.related === null || isString(event.related)),
  'text-start': (event) => isString(event.id),
  'text-delta': (event) => isString(event.id) && isString(event.delta),
  'text-end': (event) => isString(event.id),
  component: (event) =>
    isString(event.id) && isOneOf(event.component, RICH_COMPONENTS) && isRecord(event.props),
  finish: (event) => isListOf(event.followUps, isString) && isListOf(event.sources, isSource),
  error: (event) => isError(event.error),
};

export const ASSISTANT_EVENT_TYPES = Object.keys(HAS_SHAPE) as readonly AssistantEventType[];

function isEventType(value: unknown): value is AssistantEventType {
  return isOneOf(value, ASSISTANT_EVENT_TYPES);
}

/**
 * Whether a value read off the wire is an event this contract defines. A
 * component's props are resolved data the interface renders as text, so only
 * their presence is checked here.
 */
export function isAssistantEvent(value: unknown): value is AssistantEvent {
  return isRecord(value) && isEventType(value.type) && HAS_SHAPE[value.type](value);
}
