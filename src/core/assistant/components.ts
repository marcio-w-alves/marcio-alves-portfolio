import type { ProjectId, RoleId } from '@/core/knowledge/ids';

/**
 * The rich blocks an answer may contain. This is an allow-list: the interface
 * renders these and nothing else, and every prop is resolved data — never a
 * knowledge-base id the client would have to look up, and never markup.
 */

export interface MetricItem {
  readonly value: string;
  readonly label: string;
  readonly context?: string;
}

export type RoleSection =
  | { readonly title: string; readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly title: string; readonly kind: 'metrics'; readonly items: readonly MetricItem[] }
  | { readonly title: string; readonly kind: 'tags'; readonly items: readonly string[] };

export interface RoleView {
  readonly id: RoleId;
  readonly company: string;
  readonly role: string;
  readonly period: string;
  readonly summary: string;
  readonly current: boolean;
  readonly concurrent: boolean;
  readonly sections: readonly RoleSection[];
}

export interface ProjectLinkView {
  readonly label: string;
  readonly url: string;
}

export interface ProjectView {
  readonly id: ProjectId;
  readonly name: string;
  readonly category: string;
  readonly status: string;
  readonly description: string;
  readonly scopeLabel: string;
  readonly scope: readonly string[];
  readonly platforms: readonly string[];
  readonly technologies: readonly string[];
  readonly considerations: readonly string[];
  readonly links: readonly ProjectLinkView[];
}

/**
 * `inference` — an assessment drawn from documented facts.
 * `example` — illustrative, not from any real codebase.
 */
export type NoteTone = 'inference' | 'example' | 'info';

export type RichComponent =
  | { readonly component: 'metrics'; readonly props: { readonly items: readonly MetricItem[] } }
  | {
      readonly component: 'timeline';
      readonly props: { readonly roles: readonly RoleView[]; readonly expanded: readonly RoleId[] };
    }
  | {
      readonly component: 'skills';
      readonly props: {
        readonly groups: readonly { readonly title: string; readonly items: readonly string[] }[];
      };
    }
  | {
      readonly component: 'projects';
      readonly props: { readonly projects: readonly ProjectView[] };
    }
  | {
      readonly component: 'table';
      readonly props: {
        readonly columns: readonly string[];
        readonly rows: readonly (readonly string[])[];
        readonly caption: string;
      };
    }
  | {
      readonly component: 'note';
      readonly props: { readonly tone: NoteTone; readonly text: string };
    }
  | {
      readonly component: 'details';
      readonly props: { readonly summary: string; readonly text: string };
    }
  | {
      readonly component: 'contact';
      readonly props: {
        readonly heading: string;
        readonly text: string;
        readonly email: string;
        readonly linkedin: string;
        readonly github: string;
        readonly resumeUrl: string | null;
      };
    };

export type RichComponentName = RichComponent['component'];

export const RICH_COMPONENTS = [
  'metrics',
  'timeline',
  'skills',
  'projects',
  'table',
  'note',
  'details',
  'contact',
] as const satisfies readonly RichComponentName[];
