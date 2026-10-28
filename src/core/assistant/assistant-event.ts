/**
 * The streaming contract between the chat endpoint and the UI.
 *
 * These events mirror the protocol fixed by the approved design prototype,
 * so the interface and the server can evolve independently as long as both
 * keep emitting and reading this shape.
 */

export const RICH_COMPONENTS = [
  'ExperienceTimeline',
  'AchievementMetrics',
  'SkillCollection',
  'ProjectPreview',
  'ContactCard',
] as const;

export type RichComponent = (typeof RICH_COMPONENTS)[number];

export interface AnswerSource {
  readonly id: string;
  readonly label: string;
}

export type AssistantErrorCode = 'network' | 'rate_limited' | 'timeout' | 'internal';

export interface AssistantError {
  readonly code: AssistantErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type AssistantEvent =
  | { readonly type: 'start'; readonly intent: string; readonly related: readonly string[] }
  | { readonly type: 'text-start'; readonly id: string }
  | { readonly type: 'text-delta'; readonly id: string; readonly delta: string }
  | { readonly type: 'text-end'; readonly id: string }
  | {
      readonly type: 'component';
      readonly id: string;
      readonly component: RichComponent;
      readonly props: Readonly<Record<string, unknown>>;
    }
  | {
      readonly type: 'finish';
      readonly followUps: readonly string[];
      readonly sources: readonly AnswerSource[];
    }
  | { readonly type: 'error'; readonly error: AssistantError };
