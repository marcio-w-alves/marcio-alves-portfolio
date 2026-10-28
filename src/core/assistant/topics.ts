import type { ResponsePart } from './response';

/**
 * Topics are the site's pages: each opens with a curated introduction and its
 * part of the record — never a model call — and has its own conversation.
 */

export const TOPIC_IDS = [
  'overview',
  'experience',
  'skills',
  'projects',
  'philosophy',
  'education',
] as const;
export type TopicId = (typeof TOPIC_IDS)[number];

export function isTopicId(value: string): value is TopicId {
  return (TOPIC_IDS as readonly string[]).includes(value);
}

export type TopicIcon =
  'home' | 'briefcase' | 'code' | 'folder' | 'award' | 'compass' | 'graduation';

/** The full question is what gets asked; the tag names its subject. */
export interface TopicQuestion {
  readonly question: string;
  readonly tag: string;
  /** A shorter chip label for the welcome screen, where one is written. */
  readonly short?: string;
}

/** How a profile writes one topic: the page's name, introduction, questions and record. */
export interface TopicCopy {
  readonly label: string;
  readonly intro: string;
  readonly questions: readonly TopicQuestion[];
  /** What the page shows beneath its introduction: its part of the record. */
  readonly page: readonly ResponsePart[];
}

const TOPIC_ICONS: Readonly<Record<TopicId, TopicIcon>> = {
  overview: 'home',
  experience: 'briefcase',
  skills: 'code',
  projects: 'folder',
  philosophy: 'compass',
  education: 'graduation',
};

export interface Topic {
  readonly id: TopicId;
  readonly label: string;
  readonly icon: TopicIcon;
  readonly intro: string;
  readonly questions: readonly TopicQuestion[];
}

/** A question ready to show, with its tag and its chip label resolved. */
export interface SuggestedQuestion {
  readonly question: string;
  readonly tag: string;
  readonly short: string;
}

/** The site's pages, their introductions and the questions each suggests. */
export interface TopicCatalog {
  readonly topics: readonly [Topic, ...Topic[]];
  readonly topicById: (id: string) => Topic;
  /** Rotates through a topic's pool so the screen never lists every prompt at once. */
  readonly suggestedQuestions: (
    topicId: string,
    page: number,
    count: number,
  ) => SuggestedQuestion[];
  /** The same rotation, as the bare questions. */
  readonly suggestions: (topicId: string, page: number, count: number) => string[];
  /** What a topic's page shows beneath its introduction. */
  readonly pageOf: (topicId: TopicId) => readonly ResponsePart[];
}

export function createTopicCatalog(copy: Readonly<Record<TopicId, TopicCopy>>): TopicCatalog {
  const topicOf = (id: TopicId): Topic => ({
    id,
    label: copy[id].label,
    icon: TOPIC_ICONS[id],
    intro: copy[id].intro,
    questions: copy[id].questions,
  });
  // A tuple, so the first topic is a known fallback rather than a possibly-undefined index.
  const [firstId, ...otherIds] = TOPIC_IDS;
  const topics: readonly [Topic, ...Topic[]] = [topicOf(firstId), ...otherIds.map(topicOf)];

  function topicById(id: string): Topic {
    return topics.find((topic) => topic.id === id) ?? topics[0];
  }

  function suggestedQuestions(topicId: string, page: number, count: number) {
    const pool = topicById(topicId).questions;
    const size = Math.min(count, pool.length);
    const start = (page * size) % pool.length;
    const rotated = [...pool.slice(start), ...pool.slice(0, start)];
    return rotated.slice(0, size).map(({ question, tag, short }) => ({
      question,
      tag,
      short: short ?? tag,
    }));
  }

  return {
    topics,
    topicById,
    suggestedQuestions,
    suggestions: (topicId, page, count) =>
      suggestedQuestions(topicId, page, count).map((suggestion) => suggestion.question),
    pageOf: (topicId) => copy[topicId].page,
  };
}
