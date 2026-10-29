/**
 * What the fast path's router recognizes, whatever the language: the intents
 * it scores, the guards it refuses with, and the shape of the rules each
 * language writes for them.
 */

export const SCORED_INTENTS = [
  'identity',
  'resume',
  'contact',
  'location',
  'accessibility',
  'testing',
  'mobile',
  'designSystems',
  'nextjs',
  'codeQuality',
  'qualityImprovement',
  'awards',
  'teamGrowth',
  'leadRole',
  'product',
  'scratch',
  'scaling',
  'enterprise',
  'roleFit',
  'aiEngineering',
  'philosophy',
  'architecture',
  'performance',
  'backend',
  'react',
  'skills',
  'leadership',
  'achievements',
  'projects',
  'languages',
  'education',
  'career',
] as const;
export type ScoredIntent = (typeof SCORED_INTENTS)[number];

export function isScoredIntent(value: string): value is ScoredIntent {
  return (SCORED_INTENTS as readonly string[]).includes(value);
}

export type Guard = 'offPurpose' | 'privateInfo';

/** A pattern the normalized question may match, and how much a match counts. */
export type Rule = readonly [RegExp, number];

/**
 * The owner's own words for an intent — an employer's team, a school's
 * initials — which the profile adds to the generic rules.
 */
export type Vocabulary = Readonly<Partial<Record<ScoredIntent, readonly Rule[]>>>;

/** Ordered by specificity: on equal scores the earlier intent wins. */
export type IntentRules = Readonly<Record<ScoredIntent, readonly Rule[]>>;

/** How the questions name the owner, as regular-expression source. */
export interface Subject {
  readonly first: string;
  readonly full: string;
}

// \b is ASCII-only, so it never closes after an accented last letter ("Adá").
export const WORD_END = '(?![\\p{L}\\p{N}_])';

/**
 * One language's generic rules: product vocabulary, not owner data. The
 * router makes them the owner's with the record's names and the profile's
 * vocabulary.
 */
export interface LanguageRules {
  /** How a normalized question is read before any rule runs. */
  readonly prepare: (text: string) => string;
  /** Another language this one's rules would misread; the model answers it. */
  readonly foreign: RegExp;
  readonly greeting: RegExp;
  /** A request to do something — write code, a poem — which the model judges. */
  readonly taskRequest: RegExp;
  /** A grade or an exact figure, which the fast path's fixed answers do not carry. */
  readonly narrowDetail: RegExp;
  /** "Tell me more" and its kin, which continue from the last answer. */
  readonly genericFollowUp: RegExp;
  readonly comparison: RegExp;
  readonly guards: (subject: Subject) => Readonly<Record<Guard, RegExp>>;
  /** "Why did he leave…?", which asks for a reason the record rarely documents. */
  readonly whyDecision: (subject: Subject) => RegExp;
  /** "What is TypeScript?", a definition, as opposed to a question about him. */
  readonly definition: (subject: Subject) => RegExp;
  /** "What does <company> do?", given every name the record gives its companies. */
  readonly companyProfile: (anyCompany: string) => RegExp;
  readonly intents: (subject: Subject) => IntentRules;
}
