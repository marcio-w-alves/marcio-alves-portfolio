import type { Knowledge } from '@/core/knowledge/schema';
import type { ConversationContext } from '../response';
import { isTopicId, type TopicId } from '../topics';
import { ROUTED_TECHNOLOGIES, type Technology } from './technologies';

/**
 * The fast path's router: deterministic pattern scoring over the question.
 *
 * Visitor text is untrusted. It is only matched against patterns — never
 * executed, never echoed into markup — and anything this router is not
 * confident about is escalated to the model-backed path instead of being
 * answered badly.
 */

export const MAX_QUESTION_LENGTH = 1200;

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
  'quality',
  'awards',
  'teamGrowth',
  'hrisRole',
  'product',
  'scratch',
  'scaling',
  'enterprise',
  'staffFit',
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

export type Route =
  | { readonly intent: ScoredIntent }
  | { readonly intent: Guard }
  | { readonly intent: 'greeting' }
  | { readonly intent: 'company'; readonly role: string }
  | { readonly intent: 'project'; readonly project: string }
  | { readonly intent: 'technology'; readonly technologies: readonly Technology[] }
  | { readonly intent: 'escalate'; readonly nearest: ScoredIntent | null };

// English only: a question in another language is escalated before these run,
// and the model applies the same rules in the visitor's language.
// "act as" refuses only when addressed to the assistant ("did he act as a tech
// lead" is a career question). A private word that is also an engineering word
// ("React children", "codebase health issues", "password reset", "saga
// compensation steps") refuses only when the question is about him.
const GUARDS: Readonly<Record<Guard, RegExp>> = {
  offPurpose:
    /\b(ignore (all |any )?(the )?(previous|prior|above|earlier)|system prompt|you are now|pretend (to be|you)|jailbreak|developer mode|disregard (your|the|all)|reveal (your|the) (instructions|prompt|rules))\b|(^|[.!?;:] )((please|hey|ok|okay|alright|now|so|just|then|from now on),? )*act as\b|\byou ((?!he\b|m[aá]rcio\b)\w+ ){0,2}act as\b/,
  // City-level location is shareable; a home address is not.
  privateInfo:
    /\b(salary|salaries|hourly rate|day rate|(his|m[aá]rcio( alves)?'s) (age|birthday|kids|children|wife|husband|girlfriend|boyfriend|religio\w*|politic\w*|(mental |physical )?health|(\w+ )?compensation|(\w+ )?password(?! (reset|hashing|policy|flow|manager))|(mobile|cell)( phone)?)|compensation (is he|does he|expectations?|package|range)|what compensation|(any|has|have|had) health (problems|issues|conditions?)|how many (kids|children)|(is|was) (he|m[aá]rcio) (married|single|divorced|religious)|he's (married|single|divorced|religious)|(does|did|has) (he|m[aá]rcio) (have|got) (any )?(kids|children|a wife|a husband|a girlfriend|a boyfriend)|how old is (he|m[aá]rcio)|how much (does|do|did) (he|m[aá]rcio) (charge|make|earn)|home address|street address|(phone|mobile|cell) number)\b/,
};

// No \b: without the u flag it is ASCII-only, so it never matches after the "á"
// of "olá". The trailing [!. ]*$ already keeps "hint" from reading as "hi".
const GREETING = /^(hi|hello|hey|hola|olá|oi|good (morning|afternoon|evening))[!. ]*$/;

// The fast path's answers are written in English, so a question in another
// language goes to the model, which replies in the visitor's language. Only
// unambiguous markers count: "do", "no" and "com" are English too, and "é"
// appears in "résumé". A word ending in an accented letter cannot be listed —
// \b never closes after it — which is why the accents are a class of their own.
const NON_ENGLISH =
  /[ãõçâêôàñ¿¡]|\b(ele|ela|voce|sobre|qual|quais|quanto|onde|como|tem|não|nao|são|sao|dele|dela|seu|sua|uma|que|para|trabalhou|fala|carreira|experiência|experiencia|cuál|cómo|dónde|tiene|usted|habla|carrera)\b/;

// A request to do something — write code, a poem, an email — is not a
// question about Marcio a keyword can answer; the model decides whether it is
// in scope.
const TASK_REQUEST =
  /^(can you |could you |would you |please |pls )?(write|create|generate|code|make|draft|compose|implement|build|translate)\b/;

// "Why did he leave Deel?" asks for a reason the record rarely documents; a
// keyword match would answer about the company instead of saying so.
const WHY_DECISION = /^why (did|does|do|is|was|has|would) (he|marcio)\b/;

// A grade or an exact figure is a detail the fast path's fixed answers do not
// carry; matching "university" or "typescript" would answer around it.
const NARROW_DETAIL = /\b(gpa|grades?|exact|exactly)\b/;

type Rule = readonly [RegExp, number];

/** Ordered by specificity: on equal scores the earlier intent wins. */
const INTENT_RULES: Readonly<Record<ScoredIntent, readonly Rule[]>> = {
  identity: [
    [/\bare you (marcio|him|a bot|an ai|real|human)\b/, 5],
    [/\bwho are you\b/, 5],
    [/\bwhat are you\b/, 4],
    [/\bam i (talking|speaking) to\b/, 4],
  ],
  resume: [
    // \b cannot close after the accented "é" (ASCII-only without the u flag).
    [/\b(resume|cv)\b|\brésumé/, 5],
    [/\bpdf\b/, 2],
  ],
  contact: [
    [/\bcontact\b/, 4],
    [/\bget in touch\b/, 4],
    [/\breach (him|marcio|out)\b/, 4],
    [/\b(e-?mail)\b/, 3],
    [/\blinkedin\b/, 3],
    [/\btalk to (him|marcio)\b/, 3],
    [/\bavailab\w*\b/, 2],
  ],
  location: [
    [/\bwhere (is he|does he|is marcio|does marcio) (based|live|located|from)\b/, 5],
    [/\bwhich city\b/, 5],
    [/\b(hometown|based in|lives in)\b/, 4],
    [/\bcity\b/, 3],
    [/\bcountry\b/, 2],
  ],
  accessibility: [
    [/\baccessib\w*\b/, 5],
    [/\b(a11y|wcag)\b/, 5],
    [/\bscreen readers?\b/, 3],
  ],
  testing: [
    [/\btest(s|ing|ed)?\b/, 4],
    [/\b(tdd|unit tests?|e2e)\b/, 4],
  ],
  mobile: [
    [/\bmobile\b/, 4],
    [/\b(pwa|ios|iphone|android|native apps?)\b/, 3],
    [/\bapps?\b/, 0.5],
  ],
  designSystems: [
    [/\bdesign systems?\b/, 5],
    [/\bcomponent librar\w*\b/, 4],
    [/\bui kit\b/, 2],
  ],
  nextjs: [
    [/\bnext\.?js\b/, 4],
    [/\b(ssr|server[- ]side render\w*)\b/, 4],
    [/\bseo\b/, 2],
  ],
  codeQuality: [
    [/\bcode quality\b/, 5],
    [/\bclean code\b/, 4],
    [/\bquality\b/, 2],
  ],
  quality: [
    [/\bbacklog\b/, 4],
    [/\bbugs?\b/, 2],
    [/\bsupport tickets?\b/, 2],
  ],
  awards: [
    [/\bawards?\b/, 4],
    [/\bgolden\b/, 3],
    [/\brecogni\w*\b/, 2],
  ],
  teamGrowth: [
    [/\bgr[eo]w\w*\b.*\bteam\b/, 4],
    [/\bteam\b.*\bgr[eo]w\w*\b/, 4],
    [/\bhiring\b/, 2],
  ],
  hrisRole: [
    [/\bhris\b/, 3],
    [/\b(role|position) (in|on) the\b/, 1],
  ],
  product: [
    [/\bproduct (teams?|managers?|collaboration|decisions?|people)\b/, 4],
    [/\bstakeholders?\b/, 3],
    [/\bwork with (product|design)\w*\b/, 3],
    [/\bokrs?\b/, 2],
  ],
  scratch: [
    [/\bfrom scratch\b/, 4],
    [/\bground up\b/, 4],
    [/\bgreenfield\b/, 4],
    [/\bzero to one\b/, 3],
    [/\bbuilt something\b/, 1],
  ],
  scaling: [[/\bscal(e|es|ed|ing|able|ability)\b/, 3]],
  enterprise: [
    [/\benterprise\b/, 4],
    [/\blarge[- ]scale\b/, 2],
    [/\bcomplex (products?|applications?|systems?)\b/, 2],
  ],
  staffFit: [
    [/\bstaff\b/, 3],
    [/\bfit\b/, 3],
    [/\bgood (candidate|hire|match)\b/, 3],
    [/\bstrong\b.*\b(engineer|candidate)\b/, 1],
    [/\bposition\b/, 1],
    [/\bhire\b/, 2],
    [/\bwhy (should|would) (we|i)\b/, 2],
  ],
  aiEngineering: [
    [/\b(codex|claude( code)?|cursor|copilot)\b/, 5],
    [/\b(ai|llms?|artificial intelligence|genai)\b/, 4],
    [/\b(agents?|agentic|prompts?|rag)\b/, 2],
  ],
  philosophy: [
    [/\bphilosoph\w*\b/, 5],
    [/\bprinciples?\b/, 3],
    [/\bmindset\b/, 3],
    [/\bvalues\b/, 2],
    [/\bbelie(f|fs|ve)\b/, 2],
    [/\bhow does he (think|work)\b/, 2],
  ],
  architecture: [
    [/\barchitect\w*\b/, 3],
    [/\bsystem design\b/, 3],
    [/\bstate management\b/, 2],
    [/\bcomposition\b/, 2],
    [/\bdecisions?\b/, 1],
    [/\bpatterns?\b/, 1],
    [/\bstructur\w*\b/, 1],
  ],
  performance: [
    [/\bperformance\b/, 3],
    [/\b(web vitals|vitals|core web)\b/, 3],
    [/\boptimi[sz]\w*\b/, 3],
    [/\b(speed|faster|loading|load times?)\b/, 2],
    [/\blighthouse\b/, 2],
  ],
  backend: [
    [/\bback-?end\b/, 4],
    [/\bnode(\.?js)?\b/, 3],
    [/\bfull[- ]?stack\b/, 3],
    [/\bapis?\b/, 2],
    [/\b(databases?|postgres\w*|sql|redis)\b/, 2],
    [/\bmicroservices?\b/, 2],
    [/\b(infrastructure|aws|ci\/cd|devops)\b/, 1.5],
    [/\bserver\b/, 1],
  ],
  react: [
    [/\breact\b/, 3],
    [/\b(typescript|ts)\b/, 2],
    [/\b(javascript|js)\b/, 1.5],
  ],
  skills: [
    [/\bprogramming languages?\b/, 5],
    [/\bskills?\b/, 3],
    [/\bstack\b/, 3],
    [/\btechnolog\w*\b/, 2],
    [/\bexpertise\b/, 2],
    [/\bgood at\b/, 2],
    // Alone, "tools" is too weak to answer on: "internal tools" is not his stack.
    [/\btools?\b/, 1],
    [/\bstrongest\b/, 1],
  ],
  leadership: [
    [/\blead(s|ing|er|ership)?\b/, 2],
    [/\bled\b/, 2],
    [/\bmentor\w*\b/, 2],
    [/\bmanag\w*\b/, 1.5],
    [/\bteams?\b/, 1],
  ],
  achievements: [
    [/\bachiev\w*\b/, 3],
    [/\baccomplish\w*\b/, 3],
    [/\bmeasurable\b/, 3],
    [/\bimpact\b/, 2],
    [/\bresults?\b/, 2],
    [/\bmetrics?\b/, 2],
    [/\bproud\b/, 2],
    [/\bimprovements?\b/, 1],
    [/\bbiggest\b/, 1],
  ],
  projects: [
    [/\bprojects?\b/, 3],
    [/\bworking on\b/, 2],
    [/\bside\b/, 2],
    [/\bconcepts?\b/, 2],
    [/\b(his own|own) products?\b/, 3],
    [/\bproducts?\b/, 1.5],
    [/\bbuilding\b/, 1],
  ],
  languages: [
    [/\bspeak\w*\b/, 3],
    [/\blanguages?\b/, 3],
    [/\b(english|french|spanish|portuguese)\b/, 3],
  ],
  education: [
    [/\beducation\w*\b/, 4],
    [/\bdegree\b/, 4],
    [/\b(university|college|ufpb)\b/, 4],
    [/\bstud(y|ied)\b/, 3],
    [/\bgraduat\w*\b/, 3],
    [/\b(certif\w*|courses?|udemy)\b/, 4],
  ],
  career: [
    [/\bcareer\b/, 3],
    [/\bwho is (marcio|he)\b/, 3],
    [/\bbackground\b/, 2],
    [/\bhistory\b/, 2],
    [/\btimeline\b/, 2],
    [/\bjourney\b/, 2],
    [/\b(overview|summary|summari[sz]e)\b/, 2],
    [/\btell me about (marcio|him)\b/, 2],
    [/\bexperience\b/, 0.5],
  ],
};

/** How the questions name each employer, as regular-expression source. */
const COMPANY_NAMES: Readonly<Record<string, string>> = {
  way2b1: 'way ?2 ?b ?1',
  deel: 'deel',
  roots: 'roots',
  maison: 'maison( moderne?)?',
  shall: 'shall (and|&) partners',
  webfi: 'webfi',
  freelance: 'freelanc\\w*',
};
const COMPANY_WEIGHT = 2.5;

/** Below this score the router is guessing, and a guess is worse than escalating. */
const CONFIDENCE_THRESHOLD = 1.5;

// The whole message, not its first word: "how many repositories…" and "and
// what did he do there…" are questions of their own, not "tell me more".
const GENERIC_FOLLOW_UP =
  /^(tell me more|more|go on|continue|and|why|how|explain( more)?|elaborate|details?|more details|can you elaborate)[?.! ]*$/;

// A keyword router answers one intent. Questions that compare, or that are
// long enough to carry several asks, go to the model so they are answered
// whole rather than in part.
const COMPARISON = /\b(compare|comparison|versus|vs\.?|difference|differ\w*)\b/;
const MAX_FAST_PATH_WORDS = 25;

// "What is TypeScript?" asks for a definition, which needs the technology
// brief tool, not an account of Marcio's experience. Questions about him
// ("what is he working on", "what are his skills") are not definitions.
const DEFINITION = /^(what is|what's|what are|o que é|define|explain what) (?!(he|his|marcio)\b)/;
const ANY_COMPANY = Object.values(COMPANY_NAMES).join('|');
const COMPANY_PROFILE = new RegExp(
  `\\b(what (kind|type|sort) of (company|business|startup)|what does (the company|${ANY_COMPANY}) do)\\b`,
);

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
  quality: null,
  awards: null,
  teamGrowth: null,
  hrisRole: null,
  product: null,
  scratch: null,
  scaling: null,
  enterprise: null,
  staffFit: 'leadership',
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

function scoreIntents(text: string): Scored {
  let best: Scored = { intent: null, score: 0 };
  for (const intent of SCORED_INTENTS) {
    const total = INTENT_RULES[intent].reduce(
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

function isCompound(text: string, companies: readonly string[]): boolean {
  return (
    COMPARISON.test(text) || companies.length > 1 || text.split(' ').length > MAX_FAST_PATH_WORDS
  );
}

// The context arrives from the visitor, so only ids this router knows are
// looked up — never a name like "constructor" that every object answers to.
function fromContext({ lastIntent, topic }: ConversationContext): ScoredIntent {
  if (lastIntent?.startsWith('company:')) return 'achievements';
  const next = lastIntent && isScoredIntent(lastIntent) ? NEXT_INTENT[lastIntent] : null;
  return next ?? (isTopicId(topic) ? TOPIC_DEFAULT[topic] : 'career');
}

export type Router = (question: string, context: ConversationContext) => Route;

export function createRouter({ experience, projects }: Knowledge): Router {
  const companies = experience.flatMap((role) => {
    const name = COMPANY_NAMES[role.id];
    return name ? [{ id: role.id, pattern: new RegExp(`\\b${name}\\b`) }] : [];
  });
  const mentionedCompanies = (text: string) =>
    companies.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id);
  const matchProject = (text: string) =>
    projects.find((project) => text.includes(project.name.toLowerCase()))?.id ?? null;
  return (question, context) =>
    routeWith(normalize(question), context, { mentionedCompanies, matchProject });
}

interface RecordMatchers {
  readonly mentionedCompanies: (text: string) => string[];
  readonly matchProject: (text: string) => string | null;
}

function routeWith(
  text: string,
  context: ConversationContext,
  { mentionedCompanies, matchProject }: RecordMatchers,
): Route {
  if (!text || NON_ENGLISH.test(text)) return { intent: 'escalate', nearest: null };
  if (GUARDS.offPurpose.test(text)) return { intent: 'offPurpose' };
  if (GUARDS.privateInfo.test(text)) return { intent: 'privateInfo' };
  if (GREETING.test(text)) return { intent: 'greeting' };

  const companies = mentionedCompanies(text);
  const best = scoreIntents(text);
  if (
    isCompound(text, companies) ||
    TASK_REQUEST.test(text) ||
    WHY_DECISION.test(text) ||
    NARROW_DETAIL.test(text)
  ) {
    return { intent: 'escalate', nearest: best.intent };
  }

  const project = matchProject(text);
  if (project) return { intent: 'project', project };
  if (DEFINITION.test(text) || COMPANY_PROFILE.test(text))
    return { intent: 'escalate', nearest: best.intent };

  const technologies = matchTechnologies(text);
  if (technologies.length > 0) return { intent: 'technology', technologies };

  const [company] = companies;
  if (company && COMPANY_WEIGHT > best.score) return { intent: 'company', role: company };

  if (best.score <= 1 && GENERIC_FOLLOW_UP.test(text)) return { intent: fromContext(context) };
  if (best.intent === null || best.score < CONFIDENCE_THRESHOLD) {
    return { intent: 'escalate', nearest: best.intent };
  }
  return { intent: best.intent };
}
