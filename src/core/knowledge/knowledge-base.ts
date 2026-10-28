import type { AnswerSource } from '@/core/assistant/assistant-event';
import { education, languages } from './data/education';
import { experience } from './data/experience';
import { metrics } from './data/metrics';
import * as practice from './data/practice';
import { assistant, contact, principles, profile, welcome } from './data/profile';
import { projects } from './data/projects';
import { certifications, skills } from './data/skills';
import { sourceLabels } from './data/sources';
import type { ProjectId, RoleId, SourceId } from './ids';
import type { Project, Role } from './types';

/**
 * The single source of truth for every fact the assistant and the interface
 * present. Nothing else hardcodes career data.
 */
export const knowledgeBase = {
  profile,
  welcome,
  assistant,
  contact,
  principles,
  metrics,
  experience,
  skills,
  certifications,
  projects,
  education,
  languages,
  practice,
} as const;

export type KnowledgeBase = typeof knowledgeBase;

// Coverage of every id is asserted by the knowledge-base tests, which is what
// makes these lookups total.
const rolesById = Object.fromEntries(experience.map((role) => [role.id, role])) as Record<
  RoleId,
  Role
>;
const projectsById = Object.fromEntries(projects.map((project) => [project.id, project])) as Record<
  ProjectId,
  Project
>;

export function roleById(id: RoleId): Role {
  return rolesById[id];
}

export function projectById(id: ProjectId): Project {
  return projectsById[id];
}

export function sourceOf(id: SourceId): AnswerSource {
  return { id, label: sourceLabels[id] };
}

/** Whether a role overlapped in time with any other. An open end means "still running". */
export function isConcurrent(target: Role): boolean {
  const targetEnd = target.end ?? Infinity;
  return experience.some(
    (other) =>
      other.id !== target.id && target.start < (other.end ?? Infinity) && other.start < targetEnd,
  );
}
