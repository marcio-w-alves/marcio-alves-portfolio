/**
 * The shape of the record the assistant and the pages answer from.
 *
 * A profile authors it once, with every visitor-facing text written per
 * locale (`Localized`) and every id, date, metric value, URL and name written
 * once. `localize` turns that source into the monolingual `Knowledge` the
 * core reads, which is why the runtime types below are derived rather than
 * written a second time.
 */

/** A text as it reads in each language the site speaks. */
export interface Localized {
  readonly en: string;
}

export type Locale = keyof Localized;

/** A source type with every `Localized` text replaced by the text of one locale. */
export type Monolingual<T> = T extends Localized
  ? string
  : T extends readonly (infer Item)[]
    ? readonly Monolingual<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: Monolingual<T[Key]> }
      : T;

export interface MetricSource {
  readonly value: string;
  readonly label: Localized;
  /** The company where it happened, as the résumé names it. */
  readonly context: string;
  readonly source: string;
}

export interface RoleSource {
  readonly id: string;
  readonly company: string;
  /** The job title, as the résumé writes it. */
  readonly role: string;
  /** The label visitors see. */
  readonly period: string;
  /** Fractional years, used only to detect overlapping roles. */
  readonly start: number;
  readonly end: number | null;
  readonly current: boolean;
  readonly summary: Localized;
  readonly responsibilities: readonly Localized[];
  readonly leadership: readonly Localized[];
  readonly achievements: readonly Localized[];
  readonly focus: readonly Localized[];
  /** Ids of the metrics this role produced. */
  readonly metrics: readonly string[];
  /**
   * The resume's own bullet points, verbatim. The condensed fields above
   * shape the interface; these are the factual record retrieval searches.
   */
  readonly highlights: readonly Localized[];
  readonly source: string;
}

export interface SkillGroupSource {
  readonly id: string;
  readonly title: Localized;
  readonly items: readonly Localized[];
}

export interface ProjectLinkSource {
  readonly label: Localized;
  readonly url: string;
}

export interface ProjectSource {
  readonly id: string;
  readonly name: string;
  readonly category: Localized;
  readonly status: Localized;
  /** Whether the product has a public site; a concept has none. */
  readonly live: boolean;
  readonly description: Localized;
  /** "Key features" for a live product, "Planned scope" for a concept. */
  readonly scopeLabel: Localized;
  readonly scope: readonly Localized[];
  readonly platforms: readonly Localized[];
  readonly technologies: readonly string[];
  readonly considerations: readonly Localized[];
  readonly links: readonly ProjectLinkSource[];
  readonly source: string;
}

export interface PrincipleSource {
  readonly title: Localized;
  readonly text: Localized;
}

export interface EducationSource {
  readonly degree: Localized;
  readonly school: string;
  readonly schoolShort: string;
  readonly location: Localized;
  readonly year: number;
  readonly source: string;
}

export interface LanguageSource {
  readonly name: Localized;
  readonly level: 'Native' | 'Fluent' | 'Intermediate';
}

export interface CertificationSource {
  readonly name: string;
  readonly issuer: string;
}

export interface LocationSource {
  readonly country: Localized;
  /** Null until the owner confirms it; the assistant says so instead of guessing. */
  readonly city: string | null;
}

export interface ProfileSource {
  readonly name: string;
  readonly firstName: string;
  readonly initials: string;
  readonly title: Localized;
  readonly yearsLabel: Localized;
  readonly careerStartYear: number;
  readonly specializations: readonly Localized[];
  readonly summary: Localized;
  readonly context: Localized;
  readonly focus: Localized;
  readonly location: LocationSource;
  readonly source: string;
}

export interface WelcomeSource {
  readonly heading: Localized;
  readonly description: Localized;
  readonly placeholder: Localized;
  readonly helper: Localized;
}

/** How the assistant presents itself beside its answers. */
export interface AssistantIdentitySource {
  readonly name: Localized;
  readonly initials: string;
}

export interface Contact {
  readonly email: string;
  readonly linkedin: string;
  readonly github: string;
  /** Null while no PDF is published; the contact card hides the download. */
  readonly resumeUrl: string | null;
}

export interface CaseStudySource {
  readonly problem: Localized;
  readonly angles: readonly Localized[];
}

export interface StackAreaSource {
  readonly area: Localized;
  readonly items: Localized;
}

/** How the owner works, condensed from the notes for the pages and the fast path. */
export interface PracticeSource {
  readonly designProcess: readonly Localized[];
  readonly decisionCriteria: readonly Localized[];
  readonly workflow: readonly Localized[];
  /** Keyed by role id. */
  readonly caseStudies: Readonly<Record<string, CaseStudySource>>;
  readonly skillDepth: readonly StackAreaSource[];
  readonly toolset: readonly StackAreaSource[];
  readonly fullStack: {
    readonly summary: Localized;
    readonly byCompany: readonly Localized[];
    readonly ownProducts: Localized;
  };
  readonly aiEngineering: {
    readonly summary: Localized;
    readonly tools: readonly Localized[];
    readonly practices: readonly Localized[];
    readonly inProducts: Localized;
  };
  readonly leadershipPractice: {
    readonly style: Localized;
    readonly balance: Localized;
    readonly habits: readonly Localized[];
  };
  readonly studies: readonly Localized[];
  readonly learningStyle: Localized;
  /** Keyed by project id; every project has one. */
  readonly productDepth: Readonly<Record<string, Localized>>;
  readonly goals: {
    readonly roles: Localized;
    readonly mode: Localized;
    readonly challenges: Localized;
  };
  readonly interests: readonly Localized[];
  readonly careerArc: readonly Localized[];
  readonly frontendArchitecture: readonly Localized[];
  readonly performanceApproach: readonly Localized[];
  readonly qualityPractices: readonly Localized[];
  readonly mobileExplorations: Localized;
}

/** A passage of the owner's knowledge-base document, as `pnpm notes:build` splits it. */
export interface Note {
  /** Stable while the document's numbering is. */
  readonly id: string;
  readonly text: string;
}

export interface KnowledgeSource {
  readonly profile: ProfileSource;
  readonly welcome: WelcomeSource;
  readonly assistant: AssistantIdentitySource;
  readonly contact: Contact;
  readonly principles: readonly PrincipleSource[];
  /** Keyed by metric id. */
  readonly metrics: Readonly<Record<string, MetricSource>>;
  /** Newest first. */
  readonly experience: readonly RoleSource[];
  readonly skills: readonly SkillGroupSource[];
  /** Coursework, not professional experience. */
  readonly certifications: readonly CertificationSource[];
  readonly projects: readonly ProjectSource[];
  readonly education: EducationSource;
  readonly languages: readonly LanguageSource[];
  readonly practice: PracticeSource;
  /** How an answer credits each source, keyed by source id. */
  readonly sourceLabels: Readonly<Record<string, Localized>>;
  readonly notes: readonly Note[];
}

export type Knowledge = Monolingual<KnowledgeSource>;
export type Metric = Monolingual<MetricSource>;
export type Role = Monolingual<RoleSource>;
export type SkillGroup = Monolingual<SkillGroupSource>;
export type Project = Monolingual<ProjectSource>;
export type Principle = Monolingual<PrincipleSource>;
export type Education = Monolingual<EducationSource>;
export type Language = Monolingual<LanguageSource>;
export type Certification = Monolingual<CertificationSource>;
export type Welcome = Monolingual<WelcomeSource>;
export type AssistantIdentity = Monolingual<AssistantIdentitySource>;
export type CaseStudy = Monolingual<CaseStudySource>;
