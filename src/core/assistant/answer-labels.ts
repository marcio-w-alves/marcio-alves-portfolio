import type { NoteTone } from '../chat/components';
import type { Template } from '../i18n/format';

/**
 * The words inside an answer's cards — section titles, badges, the names of
 * the cards and the contact card's actions — written by the profile in each
 * language. They are the answer's, not the page's: an English answer on a
 * Portuguese page reads "Current", and a Portuguese one on an English page
 * "Atual". The interface around an answer keeps the page's language.
 */
export interface AnswerLabels {
  /** The titles of a role's sections in the career timeline. */
  readonly roleSections: {
    readonly responsibilities: string;
    readonly impact: string;
    readonly leadership: string;
    readonly achievements: string;
    readonly focus: string;
  };
  readonly badges: { readonly current: string; readonly contract: string };
  /** How assistive technology names each card. */
  readonly cards: {
    readonly metrics: string;
    readonly skills: string;
    /** Read after the number of skills in a group. */
    readonly skillsUnit: string;
    readonly timeline: string;
    readonly table: string;
  };
  readonly project: {
    /** `{project}`: how assistive technology names a project's card. */
    readonly card: Template;
    readonly platforms: string;
    readonly technologies: string;
    readonly considerations: string;
    readonly outcomes: string;
  };
  readonly notes: Readonly<Record<NoteTone, string>>;
  readonly contact: {
    readonly heading: string;
    /** `{firstName}`. */
    readonly text: Template;
    /** `{firstName}`. */
    readonly email: Template;
    readonly linkedin: string;
    readonly resume: string;
    readonly github: string;
  };
}
