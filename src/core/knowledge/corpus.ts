import type { SourceId } from './ids';
import notes from './data/notes.json';
import { knowledgeBase } from './knowledge-base';
import type { Project } from './types';

/**
 * The knowledge base flattened into categorized passages for retrieval.
 *
 * Each resume statement is its own passage, carrying its company, role and
 * period in the text, so a match is precise and still says where the fact
 * comes from. Marcio's knowledge-base document follows as its own passages
 * (see notes.ts): the résumé records what he did, the notes add how he works,
 * what he studies and builds, and what he is interested in. Contact details are deliberately absent: they are served by an
 * action, never retrieved by similarity.
 */

export const CHUNK_CATEGORIES = [
  'profile',
  'experience',
  'skills',
  'education',
  'languages',
  'certifications',
  'projects',
  'principles',
  'notes',
] as const;
export type ChunkCategory = (typeof CHUNK_CATEGORIES)[number];

export interface KnowledgeChunk {
  /** Stable across rebuilds, so the index can be checked against the corpus. */
  readonly id: string;
  readonly category: ChunkCategory;
  readonly text: string;
  readonly source: SourceId;
}

function list(items: readonly string[]): string {
  return items.join(', ');
}

function liveProductText(project: Project): string {
  const site = project.links.map((link) => link.url).join(', ');
  return `${project.name}, one of Marcio's own products with a public site (${project.category}), status: ${project.status}. ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Platforms: ${list(project.platforms)}. Public site: ${site}. Only what the public site states is documented — no users, revenue or release dates.`;
}

function conceptText(project: Project): string {
  return `${project.name}, one of Marcio's product concepts (${project.category}): ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Only planned scope is documented — no implementation, users, revenue or release dates.`;
}

export function buildCorpus(): KnowledgeChunk[] {
  const {
    profile,
    experience,
    skills,
    certifications,
    education,
    languages,
    projects,
    principles,
  } = knowledgeBase;
  return [
    {
      id: 'profile',
      category: 'profile',
      text: `Professional profile of ${profile.name}, ${profile.title} with ${profile.yearsLabel} of experience since ${String(profile.careerStartYear)}. ${profile.summary} ${profile.context} ${profile.focus} Specializations: ${list(profile.specializations)}. Based in ${profile.location.country}.`,
      source: profile.source,
    },
    ...experience.flatMap((role): KnowledgeChunk[] => [
      {
        id: `role:${role.id}`,
        category: 'experience',
        text: `${role.company} — ${role.role}, ${role.period}${role.current ? ' (current role)' : ''}. ${role.summary}`,
        source: role.source,
      },
      ...role.highlights.map((statement, index): KnowledgeChunk => ({
        id: `role:${role.id}:${String(index)}`,
        category: 'experience',
        text: `${role.company} (${role.role}, ${role.period}): ${statement}`,
        source: role.source,
      })),
    ]),
    ...skills.map((group): KnowledgeChunk => ({
      id: `skills:${group.id}`,
      category: 'skills',
      text: `Skills — ${group.title}: ${list(group.items)}.`,
      source: 'resume.skills',
    })),
    {
      id: 'certifications',
      category: 'certifications',
      text: `Certifications, which are courses and not professional experience: ${list(certifications.map((item) => `${item.name} (${item.issuer})`))}.`,
      source: 'resume.certifications',
    },
    {
      id: 'education',
      category: 'education',
      text: `Education: ${education.degree} from ${education.school} (${education.schoolShort}), ${education.location}, completed in ${String(education.year)}.`,
      source: education.source,
    },
    {
      id: 'languages',
      category: 'languages',
      text: `Languages: ${list(languages.map((language) => `${language.name} (${language.level})`))}.`,
      source: 'resume.languages',
    },
    ...projects.map((project): KnowledgeChunk => ({
      id: `project:${project.id}`,
      category: 'projects',
      text: project.live ? liveProductText(project) : conceptText(project),
      source: project.source,
    })),
    ...principles.map((principle, index): KnowledgeChunk => ({
      id: `principle:${String(index)}`,
      category: 'principles',
      text: `Engineering principle — ${principle.title}: ${principle.text}`,
      source: 'principles',
    })),
    ...notes.map((note): KnowledgeChunk => ({
      id: `notes:${note.id}`,
      category: 'notes',
      text: note.text,
      source: 'notes',
    })),
  ];
}
