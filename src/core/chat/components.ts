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

/** A role's tag beside its title, worded in the answer's language. */
export interface RoleBadge {
  readonly kind: 'current' | 'contract';
  readonly label: string;
}

export interface RoleView {
  readonly id: string;
  readonly company: string;
  readonly role: string;
  readonly period: string;
  readonly summary: string;
  readonly current: boolean;
  readonly badges: readonly RoleBadge[];
  readonly sections: readonly RoleSection[];
}

export interface ProjectLinkView {
  readonly label: string;
  readonly url: string;
}

export interface ProjectView {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly status: string;
  readonly description: string;
  readonly scopeLabel: string;
  readonly scope: readonly string[];
  readonly platforms: readonly string[];
  readonly technologies: readonly string[];
  readonly considerations: readonly string[];
  readonly outcomes: readonly string[];
  readonly links: readonly ProjectLinkView[];
}

/** The words a project card shows around the project's own, in the answer's language. */
export interface ProjectLabels {
  /** `{project}`: how assistive technology names the card. */
  readonly card: string;
  readonly platforms: string;
  readonly technologies: string;
  readonly considerations: string;
  readonly outcomes: string;
}

/** The contact card's actions, in the answer's language. */
export interface ContactActions {
  readonly email: string;
  readonly linkedin: string;
  readonly resume: string;
  readonly github: string;
}

/**
 * `inference` — an assessment drawn from documented facts.
 * `example` — illustrative, not from any real codebase.
 */
export type NoteTone = 'inference' | 'example' | 'info';

/**
 * Every `label` is how assistive technology names the card; like every other
 * word inside a card, it is in the answer's language.
 */
export type RichComponent =
  | {
      readonly component: 'metrics';
      readonly props: { readonly items: readonly MetricItem[]; readonly label: string };
    }
  | {
      readonly component: 'timeline';
      readonly props: {
        readonly roles: readonly RoleView[];
        readonly expanded: readonly string[];
        readonly label: string;
      };
    }
  | {
      readonly component: 'skills';
      readonly props: {
        readonly groups: readonly { readonly title: string; readonly items: readonly string[] }[];
        readonly label: string;
        /** Read after the number of skills in a group. */
        readonly unit: string;
      };
    }
  | {
      readonly component: 'projects';
      readonly props: { readonly projects: readonly ProjectView[]; readonly labels: ProjectLabels };
    }
  | {
      readonly component: 'table';
      readonly props: {
        readonly columns: readonly string[];
        readonly rows: readonly (readonly string[])[];
        readonly caption: string;
        readonly label: string;
      };
    }
  | {
      readonly component: 'note';
      readonly props: { readonly tone: NoteTone; readonly text: string; readonly label: string };
    }
  | {
      readonly component: 'details';
      readonly props: { readonly summary: string; readonly text: string };
    }
  | {
      readonly component: 'contact';
      readonly props: {
        /** The monogram of the person to contact. */
        readonly initials: string;
        readonly heading: string;
        readonly text: string;
        readonly availability: string;
        readonly email: string;
        readonly linkedin: string;
        readonly github: string;
        readonly resumeUrl: string | null;
        readonly actions: ContactActions;
      };
    };

export type RichComponentName = RichComponent['component'];

/** A block as part of an answer or a page, before the stream gives it an id. */
export type ComponentPart = { readonly type: 'component' } & RichComponent;

export type ResponsePart = { readonly type: 'text'; readonly text: string } | ComponentPart;

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
