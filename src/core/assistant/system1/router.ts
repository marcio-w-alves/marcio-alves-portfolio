import type { Knowledge } from '@/core/knowledge/schema';
import { MAX_QUESTION_LENGTH, type ConversationContext } from '../../chat/request';
import type { TopicId } from '../../chat/topic-id';
import type { Locale } from '../../i18n/locale';
import {
  SCORED_INTENTS,
  WORD_END,
  isScoredIntent,
  type Guard,
  type IntentRules,
  type LanguageRules,
  type ScoredIntent,
  type Subject,
  type Vocabulary,
} from './intents';
import { englishRules } from './rules.en';
import { portugueseRules } from './rules.pt-BR';
import { ROUTED_TECHNOLOGIES, type Technology } from './technologies';

/**
 * The fast path's router: deterministic pattern scoring over the question,
 * with one language's rules.
 *
 * Visitor text is untrusted. It is only matched against patterns — never
 * executed, never echoed into markup — and anything this router is not
 * confident about is escalated to the model-backed path instead of being
 * answered badly.
 */

export type Route =
  | { readonly intent: ScoredIntent }
  | { readonly intent: Guard }
  | { readonly intent: 'greeting' }
  | { readonly intent: 'company'; readonly role: string }
  | { readonly intent: 'project'; readonly project: string }
  | { readonly intent: 'technology'; readonly technologies: readonly Technology[] }
  | { readonly intent: 'escalate'; readonly nearest: ScoredIntent | null };

const RULES: Readonly<Record<Locale, LanguageRules>> = {
  en: englishRules,
  'pt-BR': portugueseRules,
};

function withVocabulary(rules: IntentRules, vocabulary: Vocabulary): IntentRules {
  const merged = { ...rules };
  for (const intent of SCORED_INTENTS) {
    merged[intent] = [...rules[intent], ...(vocabulary[intent] ?? [])];
  }
  return merged;
}

const COMPANY_WEIGHT = 2.5;

/** Below this score the router is guessing, and a guess is worse than escalating. */
const CONFIDENCE_THRESHOLD = 1.5;

// A keyword router answers one intent; a question long enough to carry
// several asks goes to the model, so it is answered whole rather than in part.
const MAX_FAST_PATH_WORDS = 25;

export const NEXT_INTENT: Readonly<Record<ScoredIntent, ScoredIntent | null>> = {
  identity: null,
  resume: null,
  contact: 'career',
  location: null,
  accessibility: null,
  testing: null,
  mobile: null,
  designSystems: null,
  nextjs: null,
  codeQuality: null,
  qualityImprovement: null,
  awards: null,
  teamGrowth: null,
  leadRole: null,
  product: null,
  scratch: null,
  scaling: null,
  enterprise: null,
  roleFit: 'leadership',
  aiEngineering: null,
  philosophy: 'codeQuality',
  architecture: 'philosophy',
  performance: 'architecture',
  backend: 'skills',
  react: 'architecture',
  skills: 'react',
  leadership: 'architecture',
  achievements: 'performance',
  projects: 'scratch',
  languages: null,
  education: 'career',
  career: 'achievements',
};

export const TOPIC_DEFAULT: Readonly<Record<TopicId, ScoredIntent>> = {
  overview: 'career',
  experience: 'career',
  skills: 'skills',
  projects: 'projects',
  philosophy: 'philosophy',
  education: 'education',
};

export function normalize(question: string): string {
  return question
    .slice(0, MAX_QUESTION_LENGTH)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface Scored {
  readonly intent: ScoredIntent | null;
  readonly score: number;
}

function scoreIntents(text: string, rules: IntentRules): Scored {
  let best: Scored = { intent: null, score: 0 };
  for (const intent of SCORED_INTENTS) {
    const total = rules[intent].reduce(
      (sum, [pattern, weight]) => (pattern.test(text) ? sum + weight : sum),
      0,
    );
    if (total > best.score) best = { intent, score: total };
  }
  return best;
}

function matchTechnologies(text: string): Technology[] {
  return ROUTED_TECHNOLOGIES.filter((technology) => technology.detect.test(text));
}

function isCompound(text: string, companies: readonly string[], comparison: RegExp): boolean {
  return (
    comparison.test(text) || companies.length > 1 || text.split(' ').length > MAX_FAST_PATH_WORDS
  );
}

// The last intent arrives from the visitor, so only intents this router knows
// are looked up — never a name like "constructor" that every object answers to.
// The topic was checked against the topic ids where the request came in.
function fromContext({ lastIntent, topic }: ConversationContext): ScoredIntent {
  if (lastIntent?.startsWith('company:')) return 'achievements';
  const next = lastIntent && isScoredIntent(lastIntent) ? NEXT_INTENT[lastIntent] : null;
  return next ?? TOPIC_DEFAULT[topic];
}
export type Router = (question: string, context: ConversationContext) => Route;

// Visitors type names with or without their accents: "Jose" and "José"
// name the same person.
const ACCENTED: Readonly<Record<string, string>> = {
  a: 'aáàâãä',
  c: 'cç',
  e: 'eéèêë',
  i: 'iíìîï',
  n: 'nñ',
  o: 'oóòôõö',
  u: 'uúùûü',
};

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function spelled(name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return plain.replace(/./gsu, (letter) => {
    const variants = ACCENTED[letter];
    return variants ? `[${variants}]` : escaped(letter);
  });
}

function subjectOf({ name, firstName }: Knowledge['profile']): Subject {
  const first = `${spelled(firstName)}${WORD_END}`;
  const rest = name.slice(firstName.length).trim();
  return { first, full: rest ? `${first}( ${spelled(rest)})?` : first };
}
interface CompanyMatcher {
  readonly id: string;
  /** Every name the record gives the company, as alternatives. */
  readonly names: string;
  readonly pattern: RegExp;
}

function companyMatchers(
  experience: Knowledge['experience'],
  prepare: LanguageRules['prepare'],
): CompanyMatcher[] {
  return experience.map((role) => {
    const names = [role.company, ...(role.aliases ?? [])]
      .map((name) => escaped(prepare(name.toLowerCase())))
      .join('|');
    return { id: role.id, names, pattern: new RegExp(`\\b(${names})\\b`) };
  });
}

interface Patterns {
  readonly language: LanguageRules;
  readonly guards: Readonly<Record<Guard, RegExp>>;
  readonly whyDecision: RegExp;
  readonly definition: RegExp;
  readonly companyProfile: RegExp;
  readonly rules: IntentRules;
}

/**
 * One language's generic rules, made the owner's by the record — the name
 * visitors use, the companies and products it lists — and by the profile's
 * own words in that language.
 */
export function createRouter(knowledge: Knowledge, vocabulary: Vocabulary, locale: Locale): Router {
  const language = RULES[locale];
  const subject = subjectOf(knowledge.profile);
  const companies = companyMatchers(knowledge.experience, language.prepare);
  const patterns: Patterns = {
    language,
    guards: language.guards(subject),
    whyDecision: language.whyDecision(subject),
    definition: language.definition(subject),
    companyProfile: language.companyProfile(companies.map(({ names }) => names).join('|')),
    rules: withVocabulary(language.intents(subject), vocabulary),
  };
  const projectNames = knowledge.projects.map((project) => ({
    id: project.id,
    name: language.prepare(project.name.toLowerCase()),
  }));
  const mentionedCompanies = (text: string) =>
    companies.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id);
  const matchProject = (text: string) =>
    projectNames.find(({ name }) => text.includes(name))?.id ?? null;
  return (question, context) =>
    routeWith(language.prepare(normalize(question)), context, patterns, {
      mentionedCompanies,
      matchProject,
    });
}

interface RecordMatchers {
  readonly mentionedCompanies: (text: string) => string[];
  readonly matchProject: (text: string) => string | null;
}

function routeWith(
  text: string,
  context: ConversationContext,
  { language, guards, whyDecision, definition, companyProfile, rules }: Patterns,
  { mentionedCompanies, matchProject }: RecordMatchers,
): Route {
  if (!text || language.foreign.test(text)) return { intent: 'escalate', nearest: null };
  if (guards.offPurpose.test(text)) return { intent: 'offPurpose' };
  if (guards.privateInfo.test(text)) return { intent: 'privateInfo' };
  if (language.greeting.test(text)) return { intent: 'greeting' };

  const companies = mentionedCompanies(text);
  const best = scoreIntents(text, rules);
  if (
    isCompound(text, companies, language.comparison) ||
    language.taskRequest.test(text) ||
    whyDecision.test(text) ||
    language.narrowDetail.test(text)
  ) {
    return { intent: 'escalate', nearest: best.intent };
  }

  const project = matchProject(text);
  if (project) return { intent: 'project', project };
  if (definition.test(text) || companyProfile.test(text))
    return { intent: 'escalate', nearest: best.intent };

  const technologies = matchTechnologies(text);
  if (technologies.length > 0) return { intent: 'technology', technologies };

  const [company] = companies;
  if (company && COMPANY_WEIGHT > best.score) return { intent: 'company', role: company };

  if (best.score <= 1 && language.genericFollowUp.test(text)) {
    return { intent: fromContext(context) };
  }
  if (best.intent === null || best.score < CONFIDENCE_THRESHOLD) {
    return { intent: 'escalate', nearest: best.intent };
  }
  return { intent: best.intent };
}
