/** The site's topics, each a page with its own conversation. */
export const TOPIC_IDS = [
  'overview',
  'experience',
  'skills',
  'projects',
  'philosophy',
  'education',
] as const;
export type TopicId = (typeof TOPIC_IDS)[number];
