import type { Plural, Template } from '@/core/i18n/format';

/**
 * Every text the interface shows or announces around the record: labels,
 * actions, states and accessible names. The record's own text — names,
 * answers, topics — arrives as data instead.
 *
 * `{firstName}` and `{name}` name who the site is about and are filled on the
 * server; any other placeholder is filled where the message is shown.
 */
export interface UiMessages {
  readonly shell: {
    readonly navigation: string;
    /** The first stop for a keyboard, past the topics to the conversation. */
    readonly skipToConversation: string;
    readonly topics: string;
    readonly newConversation: string;
    readonly openNavigation: string;
    readonly closeNavigation: string;
    readonly getInTouch: string;
    readonly linkedin: string;
    readonly github: string;
    readonly resume: string;
    /** Beside "Resume" while there is no file to open. */
    readonly resumeSoon: string;
    /** The colour-theme switcher: its name and each choice. */
    readonly theme: {
      readonly label: string;
      readonly light: string;
      readonly dark: string;
      readonly system: string;
    };
  };
  /** Read by screen readers after a link's own name. */
  readonly links: {
    readonly opensInNewTab: string;
    readonly pdfOpensInNewTab: string;
  };
  /** The subject line of the emails the site starts. */
  readonly emailSubject: string;
  readonly welcome: {
    readonly region: string;
    readonly suggestedQuestions: string;
    /** Names the companies and headline metrics under the greeting. */
    readonly evidence: string;
    /** Names the contact and résumé links the welcome screen offers where the sidebar is a drawer. */
    readonly contact: string;
  };
  readonly conversation: {
    readonly label: string;
    /** The page's heading once a conversation starts on the overview. */
    readonly overviewHeading: Template;
    /** The page's heading once a conversation starts on a topic: `{topic}`. */
    readonly topicHeading: Template;
    /** Read before the visitor's own question. */
    readonly youAsked: string;
    /** The accessible name of each answer. */
    readonly answer: Template;
    /** What the assistant is doing before an answer starts, in turn. */
    readonly thinking: readonly Template[];
    readonly stopped: string;
    readonly sources: string;
    readonly followUps: string;
    readonly jumpToLatest: string;
  };
  readonly failure: {
    readonly title: string;
    /** For a failure that carries no reason. */
    readonly unknown: string;
    readonly saved: string;
    readonly retry: string;
    readonly edit: string;
  };
  /** Why an answer failed, by the error's code. */
  readonly errors: {
    readonly network: string;
    readonly timeout: string;
    readonly interrupted: string;
    readonly rejected: string;
    readonly internal: string;
    /** `{retry}` is `retryIn` or `retryLater`. */
    readonly rateLimited: Template;
    readonly retryIn: Plural;
    readonly retryLater: string;
  };
  readonly actions: {
    readonly group: string;
    readonly copy: string;
    readonly copyCode: string;
    /** A code block's caption when the answer names no language. */
    readonly plainCode: string;
    readonly copied: string;
    readonly askFollowUp: string;
    /** `{company}`: the role the answer is about. */
    readonly viewRole: Template;
    /** What "View … experience" asks: `{company}`. */
    readonly roleQuestion: Template;
    readonly helpful: string;
    readonly notHelpful: string;
    readonly thanks: string;
  };
  readonly composer: {
    readonly label: string;
    readonly followUpPlaceholder: string;
    /** Under the composer while another page's answer is on its way. */
    readonly waiting: string;
    readonly send: string;
    readonly stop: string;
    /** `{enter}` and `{shift}` are shown as keys. */
    readonly keyboardHint: Template;
    readonly enterKey: string;
    readonly shiftKey: string;
  };
  /** What a screen reader hears as the conversation changes. */
  readonly announcements: {
    readonly generating: string;
    readonly ready: string;
    readonly failed: string;
    readonly stopped: string;
    readonly newConversation: string;
  };
  readonly rich: {
    readonly metrics: string;
    readonly skills: string;
    /** Read after the number of skills in a group. */
    readonly skillsUnit: string;
    readonly timeline: string;
    readonly table: string;
    readonly current: string;
    readonly contract: string;
    /** `{project}`. */
    readonly project: Template;
    readonly platforms: string;
    readonly technologies: string;
    readonly considerations: string;
    readonly outcomes: string;
    readonly notes: {
      readonly inference: string;
      readonly example: string;
      readonly info: string;
    };
    readonly contact: {
      readonly email: Template;
      readonly linkedin: string;
      readonly resume: string;
      readonly github: string;
    };
  };
  readonly pageFailed: {
    readonly failure: string;
    readonly title: string;
    readonly description: string;
    readonly retry: string;
    /** `{digest}`: the reference that matches the server's log. */
    readonly reference: Template;
    /** The tab's title when the whole document had to be replaced. */
    readonly documentTitle: Template;
  };
}
