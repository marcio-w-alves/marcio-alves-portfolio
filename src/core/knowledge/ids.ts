/**
 * Every identifier the knowledge base exposes, as literal unions.
 *
 * References between records are typed with these unions, so a role that
 * cites a metric that does not exist is a compile error rather than a blank
 * card at runtime. The same arrays later become the enums the assistant's
 * tools accept, which keeps the model from inventing an id.
 */

export const ROLE_IDS = [
  'toptal',
  'deel',
  'roots',
  'maison',
  'shall',
  'webfi',
  'freelance',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const METRIC_IDS = [
  'deel-critical-load',
  'deel-web-vitals',
  'deel-people-list',
  'deel-backlog',
  'roots-team',
  'roots-slack-bot',
  'roots-initial-load',
  'maison-newsletter',
  'webfi-sales',
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

export const PROJECT_IDS = ['targup', 'formdaily', 'evcopilot', 'fictiondraft'] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

export const SKILL_GROUP_IDS = [
  'frontend',
  'architecture',
  'performance',
  'leadership',
  'backend',
] as const;
export type SkillGroupId = (typeof SKILL_GROUP_IDS)[number];

export const SOURCE_IDS = [
  'profile',
  'principles',
  'resume.toptal',
  'resume.deel',
  'resume.roots',
  'resume.maison',
  'resume.shall',
  'resume.webfi',
  'resume.freelance',
  'resume.skills',
  'resume.education',
  'resume.languages',
  'resume.certifications',
  'projects',
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
