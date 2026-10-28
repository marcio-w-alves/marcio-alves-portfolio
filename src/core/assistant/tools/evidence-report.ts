import { sourceOf } from '@/core/knowledge/knowledge-base';
import type { AnswerSource } from '../assistant-event';
import { findEvidence, TECHNOLOGIES, type Technology } from '../system1/technologies';

export type EvidenceVerdict =
  'documented' | 'reported in his notes' | 'coursework only' | 'not documented';

export interface EvidenceReport {
  readonly data: {
    readonly technology: string;
    readonly verdict: EvidenceVerdict;
    readonly professionalWork: readonly { readonly company: string; readonly statement: string }[];
    readonly listedSkills: readonly string[];
    readonly courseworkOnly: readonly string[];
    readonly reportedInNotes: readonly string[];
  };
  readonly sources: readonly AnswerSource[];
}

function technologyNamed(name: string): Technology {
  const known = TECHNOLOGIES.find((tech) => tech.name.toLowerCase() === name.toLowerCase());
  if (known) return known;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}`, 'i');
  return { name, detect: pattern, evidence: pattern };
}

const NOTES_SHOWN = 3;

/**
 * Where a technology appears in Marcio's record, never upgrading coursework
 * into experience, not even when his notes mention it too. What only his
 * notes mention is reported, not documented:
 * the passage's own tag says whether it is his account or a study.
 */
export function evidenceReport(name: string): EvidenceReport {
  const evidence = findEvidence(technologyNamed(name));
  const verdict: EvidenceVerdict =
    evidence.work.length > 0 || evidence.skills.length > 0
      ? 'documented'
      : evidence.coursework.length > 0
        ? 'coursework only'
        : evidence.notes.length > 0
          ? 'reported in his notes'
          : 'not documented';
  return {
    data: {
      technology: name,
      verdict,
      professionalWork: evidence.work.map(({ company, statement }) => ({ company, statement })),
      listedSkills: evidence.skills,
      courseworkOnly: evidence.coursework,
      reportedInNotes: evidence.notes.slice(0, NOTES_SHOWN),
    },
    sources: [
      ...new Set(evidence.work.map((item) => `resume.${item.role}` as const)),
      ...(evidence.skills.length > 0 ? (['resume.skills'] as const) : []),
      ...(evidence.coursework.length > 0 ? (['resume.certifications'] as const) : []),
      ...(evidence.notes.length > 0 ? (['notes'] as const) : []),
    ].map(sourceOf),
  };
}
