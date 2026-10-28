import type { MetricId, ProjectId, RoleId, SkillGroupId, SourceId } from './ids';

export interface Metric {
  readonly value: string;
  readonly label: string;
  readonly context: string;
  readonly source: SourceId;
}

export interface Role {
  readonly id: RoleId;
  readonly company: string;
  readonly role: string;
  /** The label visitors see. */
  readonly period: string;
  /** Fractional years, used only to detect overlapping roles. */
  readonly start: number;
  readonly end: number | null;
  readonly current: boolean;
  readonly summary: string;
  readonly responsibilities: readonly string[];
  readonly leadership: readonly string[];
  readonly achievements: readonly string[];
  readonly focus: readonly string[];
  readonly metrics: readonly MetricId[];
  /**
   * The resume's own bullet points, verbatim. The condensed fields above
   * shape the interface; these are the factual record retrieval searches.
   */
  readonly highlights: readonly string[];
  readonly source: SourceId;
}

export interface SkillGroup {
  readonly id: SkillGroupId;
  readonly title: string;
  readonly items: readonly string[];
}

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly category: string;
  readonly status: string;
  readonly description: string;
  readonly scope: readonly string[];
  readonly technologies: readonly string[];
  readonly considerations: readonly string[];
  readonly links: readonly string[];
  readonly source: SourceId;
}

export interface Principle {
  readonly title: string;
  readonly text: string;
}

export interface Education {
  readonly degree: string;
  readonly school: string;
  readonly schoolShort: string;
  readonly location: string;
  readonly year: number;
  readonly source: SourceId;
}

export interface Language {
  readonly name: string;
  readonly level: 'Native' | 'Fluent' | 'Intermediate';
}

export interface Certification {
  readonly name: string;
  readonly issuer: string;
}

export interface Location {
  readonly country: string;
  /** Null until Marcio confirms it; the assistant says so instead of guessing. */
  readonly city: string | null;
}

export interface Profile {
  readonly name: string;
  readonly firstName: string;
  readonly initials: string;
  readonly title: string;
  readonly yearsLabel: string;
  readonly careerStartYear: number;
  readonly specializations: readonly string[];
  readonly summary: string;
  readonly context: string;
  readonly focus: string;
  readonly location: Location;
  readonly source: SourceId;
}

export interface Welcome {
  readonly heading: string;
  readonly description: string;
  readonly placeholder: string;
  readonly helper: string;
}

/** How the assistant presents itself beside its answers. */
export interface AssistantIdentity {
  readonly name: string;
  readonly initials: string;
}

export interface Contact {
  readonly email: string;
  readonly linkedin: string;
  readonly github: string;
  /** Null while no PDF is published; the contact card hides the download. */
  readonly resumeUrl: string | null;
}
